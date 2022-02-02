/* Assignment 1: Space Minesweeper
 * CSCI 4611, Spring 2022, University of Minnesota
 * Instructor: Evan Suma Rosenberg <suma@umn.edu>
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */

import * as paper from 'paper';
import { stderr } from 'process';


class Game
{
    // Width and height are defined in project coordinates
    // This is different than screen coordinates!
    private width : number;
    private height : number;
    private mouseVector : paper.Point;
    private gameTimer : number;
    private mineFlag : boolean;
    private velocity : paper.Point[];
    private angle : number[];
    private explosionProgression : number[];
    private shieldCounter : number;
    private shieldFlag : boolean;

    // TypeScript will throw an error if you define a type but don't initialize in the constructor
    // This can be prevented by including undefined as a second possible type
    private world : paper.Group;
    private ship : paper.Group;
    private starField : paper.Group;
    private starFactory : paper.SymbolDefinition | undefined;
    private mineField : paper.Group;
    private mineFactory : paper.SymbolDefinition | undefined;
    private firedAmmo : paper.Group;
    private laserGenerator : paper.SymbolDefinition | undefined;
    private boomBooms : paper.Group;
    private explosionNoJutsu : paper.SymbolDefinition[];
    private shipInstance : paper.SymbolItem | undefined;
    private shields : paper.Group;
    private shieldGenerator : paper.SymbolDefinition | undefined;

    constructor()
    {
        paper.setup('canvas');
        this.width = 1200;
        this.height = 800;
        this.mouseVector = new paper.Point(0, 0);
        this.gameTimer = 0;
        this.mineFlag = false;
        this.velocity = [];
        this.angle = [];
        this.explosionProgression = [];
        this.shieldCounter = 0;
        this.explosionNoJutsu = [];
        this.shieldFlag = false;

        this.world = new paper.Group();
        this.ship = new paper.Group();
        this.starField = new paper.Group();
        this.mineField = new paper.Group();
        this.firedAmmo = new paper.Group();
        this.boomBooms = new paper.Group();
        this.shields = new paper.Group();
        this.world.addChild(this.ship);
        this.world.addChild(this.starField);
        this.world.addChild(this.mineField);
        this.world.addChild(this.firedAmmo);
        this.world.addChild(this.shields);
    }

    start() : void
    {

        this.createScene();
        this.resize();

        // This registers the event handlers for window and mouse events
        paper.view.onResize = () => {this.resize();};
        paper.view.onMouseMove = (event: paper.MouseEvent) => {this.onMouseMove(event);};
        paper.view.onMouseDown = (event: paper.MouseEvent) => {this.onMouseDown(event);};
        paper.view.onFrame = (event: GameEvent) => {this.update(event);};

    }

    // Helper function to initialize random x, y coordinates for new mines (outside the view of the screen)
    private newCoordinates() : paper.Point {
        var x_cor = this.width * Math.random();
        var y_cor = this.height * Math.random();
        if (x_cor > this.width / 2) {x_cor += this.ship.position.x;}
        else {x_cor -= this.ship.position.x;}
        if (y_cor > this.height / 2) {y_cor += this.ship.position.y;}
        else {y_cor -= this.ship.position.y;}
        return new paper.Point(x_cor, y_cor);
    }

    private blowThingsUp(location: paper.Point) : void {
        var kindling = this.explosionNoJutsu[0].place(location);
        kindling.scale(0.25);
        this.boomBooms.addChild(kindling);
        this.explosionProgression.push(0);
    }

    private createScene() : void
    {
        // This line prevents the transformation matrix from being baked directly into its children
        // Instead, will be applied every frame
        this.world.applyMatrix = false;
        this.ship.applyMatrix = false;
        this.starField.applyMatrix = false;
        this.mineField.applyMatrix = false;
        this.firedAmmo.applyMatrix = false;

        // This code block loads an SVG file asynchronously
        // It uses an arrow function to specify the code that gets executed after the file is loaded
        // We will go over this syntax in class
        paper.project.importSVG('./assets/ship.svg', (item: paper.Item) => {
            this.ship.addChild(item);
            this.ship.scale(3);
            this.ship.position.x = this.width / 2;
            this.ship.position.y = this.height / 2;
            this.ship.visible = false;
        });

        var starshipEnterprise = new paper.Raster('./assets/Enterprise.png');
        var myShip = new paper.SymbolDefinition(starshipEnterprise);
        this.shipInstance = myShip.place(new paper.Point(600, 400));
        this.shipInstance.pivot = new paper.Point(0, 0);
        this.shipInstance.scale(0.06, 0.06);

        // Declaration of circle object geometry
        var circleGeometry = new paper.Path.Circle(new paper.Point(500, 500), 6);
        circleGeometry.fillColor = new paper.Color('cyan');
        this.starFactory = new paper.SymbolDefinition(circleGeometry);

        // Populating the screen with 150 stars, and adding them to the starField group
        for (var i = 0; i < 150; i++) {
            var size = 1 * Math.random();
            var x_cord = this.width * Math.random();
            var y_cord = this.height * Math.random();
            var placed = this.starFactory.place(new paper.Point(x_cord, y_cord));
            placed.scale(size, size);
            this.starField.addChild(placed);
        }
        // Alters the scale of every star
        this.starFactory.item.scale(1, 0.5);

        // loads the SVG file for mines, and instantiates the first few mines to start off the simulation
        paper.project.importSVG('./assets/mine.svg', (item: paper.Item) => {
            item.scale(5);
            this.mineFactory = new paper.SymbolDefinition(item);
            for (var i = 0; i < 5; i++) {
                var mine = this.mineFactory.place(this.newCoordinates());
                this.mineField.addChild(mine);
                this.velocity.push(new paper.Point(0, 0));
                this.angle.push((mine.position.subtract(new paper.Point((this.width / 2), (this.height / 2)))).angle);
                this.mineFlag = true;
            }
        });

        // Declaration of rectangular object geometry
        var rectangleGeometry = new paper.Path.Rectangle(new paper.Point(0, 0), new paper.Size(60, 10));
        rectangleGeometry.strokeColor = new paper.Color('gold');
        rectangleGeometry.fillColor = new paper.Color('maroon');
        rectangleGeometry.strokeWidth = 2;
        this.laserGenerator = new paper.SymbolDefinition(rectangleGeometry);

        // Explosion animation
        var explosion0 = new paper.Raster('./assets/Explosion/explosion00.png');
        var explosion1 = new paper.Raster('./assets/Explosion/explosion01.png');
        var explosion2 = new paper.Raster('./assets/Explosion/explosion02.png');
        var explosion3 = new paper.Raster('./assets/Explosion/explosion03.png');
        var explosion4 = new paper.Raster('./assets/Explosion/explosion04.png');
        var explosion5 = new paper.Raster('./assets/Explosion/explosion05.png');
        var explosion6 = new paper.Raster('./assets/Explosion/explosion06.png');
        var explosion7 = new paper.Raster('./assets/Explosion/explosion07.png');
        var explosion8 = new paper.Raster('./assets/Explosion/explosion08.png');
        this.explosionNoJutsu[0] = new paper.SymbolDefinition(explosion0);
        this.explosionNoJutsu[1] = new paper.SymbolDefinition(explosion1);
        this.explosionNoJutsu[2] = new paper.SymbolDefinition(explosion2);
        this.explosionNoJutsu[3] = new paper.SymbolDefinition(explosion3);
        this.explosionNoJutsu[4] = new paper.SymbolDefinition(explosion4);
        this.explosionNoJutsu[5] = new paper.SymbolDefinition(explosion5);
        this.explosionNoJutsu[6] = new paper.SymbolDefinition(explosion6);
        this.explosionNoJutsu[7] = new paper.SymbolDefinition(explosion7);
        this.explosionNoJutsu[8] = new paper.SymbolDefinition(explosion8);

        // shields animation;
        var shieldsUp = new paper.Raster('./assets/shields.png');
        this.shieldGenerator = new paper.SymbolDefinition(shieldsUp);
        this.shieldGenerator.item.scale(0.18, 0.18);
    }

    // This method will be called once per frame
    private update(event: GameEvent) : void
    {
        // Animation of the stars (rotation and movement based on ship position)
        this.starFactory!.item.rotate(1);
        this.starFactory!.item.position.x -= .01 * this.mouseVector.x;
        this.starFactory!.item.position.y -= .01 * this.mouseVector.y;

        // Animation of the mines (rotation and movement based on ship position)
        if (this.mineFlag) {
            this.mineFactory!.item.rotate(1);
        }

        // Resets the position of stars that fall off the end of the screen
        for (var i = 0; i < this.starField.children.length; i++)
        {
            if (this.starField.children[i].position.x > this.width)
                this.starField.children[i].position.x -= this.width;
            else if (this.starField.children[i].position.x < 0)
                this.starField.children[i].position.x += this.width;
            if (this.starField.children[i].position.y > this.height)
                this.starField.children[i].position.y -= this.height;
            else if (this.starField.children[i].position.y < 0)
                this.starField.children[i].position.y += this.height;
        }

        // sets up the movement of mines, and a collision check with the ship
        for (var i = 0; i < this.mineField.children.length; i++)
        {
            this.velocity[i].x = -3;
            this.velocity[i].y = 0;
            this.angle[i] = (this.mineField.children[i].position.subtract(new paper.Point((this.width / 2), (this.height / 2)))).angle;
            this.velocity[i] = this.velocity[i].rotate(this.angle[i], new paper.Point(0, 0));
            this.mineField.children[i].translate(this.velocity[i]);
            var vector = new paper.Point(-0.02 * this.mouseVector.x, -0.02 * this.mouseVector.y);
            this.mineField.children[i].translate(vector);

            // Collision check between mines and the ship
            if (this.mineField.children[i].intersects(this.ship)) {
                this.shieldCounter = 0;
                if (this.shieldFlag == false) {
                    var shieldActivate = this.shieldGenerator!.place(paper.view.center);
                    this.shields.addChild(shieldActivate);
                    this.shieldFlag = true;
                    this.shields.children[0].bringToFront();
                }
                this.blowThingsUp(this.mineField.children[i].position);
                this.mineField.children[i].remove();
                this.velocity.splice(i, 1);
                this.angle.splice(i, 1);
            }

            // Collision check between mines and other mines
            for (var j = 0; j < this.mineField.children.length; j++) {
                if (i != j && i < this.mineField.children.length && this.mineField.children[i].intersects(this.mineField.children[j])) {
                    if (i > j) {
                        this.blowThingsUp(this.mineField.children[i].position);
                        this.mineField.children[i].remove();
                        this.velocity.splice(i, 1);
                        this.angle.splice(i, 1);
                        this.blowThingsUp(this.mineField.children[j].position);
                        this.mineField.children[j].remove();
                        this.velocity.splice(j, 1);
                        this.angle.splice(j, 1);
                        break;
                    }
                    else {
                        this.blowThingsUp(this.mineField.children[j].position);
                        this.mineField.children[j].remove();
                        this.velocity.splice(j, 1);
                        this.angle.splice(j, 1);
                        this.blowThingsUp(this.mineField.children[i].position);
                        this.mineField.children[i].remove();
                        this.velocity.splice(i, 1);
                        this.angle.splice(i, 1);
                        break;
                    }
                }
            }
        }

        // sets up the timer and limit to additional mine spawns
        if (this.mineFlag) {
            // timer is 46 frames
            if (this.gameTimer % 46 == 0) {
                // maximum number of mines is 25
                if (this.mineField.children.length > 25) {
                    this.mineField.children[0].remove();
                    this.velocity.splice(0, 1);
                    this.angle.splice(0, 1);
                }
                var mine = this.mineFactory!.place(this.newCoordinates());
                this.mineField.addChild(mine);
                this.velocity.push(new paper.Point(0, 0));
                this.angle.push((mine.position.subtract(new paper.Point(this.ship.position.x, this.ship.position.y))).angle);
                this.gameTimer = 0;
            }
        }
        this.gameTimer += 1;

        // iterates through all active laser beams
        for (var i = 0; i < this.firedAmmo.children.length; i++) {
            var pathOfTravel = new paper.Point(8, 0)
            pathOfTravel = pathOfTravel.rotate(this.firedAmmo.children[i].rotation, new paper.Point(0, 0));
            this.firedAmmo.children[i].translate(pathOfTravel);
            var pos_x = this.firedAmmo.children[i].position.x;
            var pos_y = this.firedAmmo.children[i].position.y;
            var x_flag = false;
            var y_flag = false;
            if (pos_x < 0 || pos_x > this.width) {x_flag = true;}
            if (pos_y < 0 || pos_y > this.height) {y_flag = true;}
            if (x_flag && y_flag) {
                this.firedAmmo.children[i].remove();
            }
            // collision check between laser beams and mines
            for (var j = 0; j < this.mineField.children.length; j++) {
                if (i < this.firedAmmo.children.length && this.firedAmmo.children[i].intersects(this.mineField.children[j])) {
                    this.firedAmmo.children[i].remove();
                    this.blowThingsUp(this.mineField.children[j].position);
                    this.mineField.children[j].remove();
                    this.velocity.splice(j, 1);
                    this.angle.splice(j, 1);
                    break;
                }
            }
        }

        // iterates through all explosions
        for (var i = 0; i < this.boomBooms.children.length; i++) {
            var vector = new paper.Point(-0.02 * this.mouseVector.x, -0.02 * this.mouseVector.y);
            this.boomBooms.children[i].translate(vector);
            // running on a timer at 5 frames
            if (this.gameTimer % 5 == 0) {
                var stage = this.explosionProgression[i];
                if (stage < 8) {
                    var growingFire = this.explosionNoJutsu[stage].place(this.boomBooms.children[i].position);
                    growingFire.scale(0.25);
                    this.boomBooms.addChild(growingFire);
                    this.explosionProgression.push(stage + 1);
                }
                this.boomBooms.children[i].remove();
                this.explosionProgression.splice(i, 1);
            }
        }


        if (this.shieldFlag) {
            // running a timer of 6 frames
            if (this.gameTimer % 6 == 0) {
                if (this.shieldCounter < 8) {
                    this.shields.children[0].rotate(30);
                    this.shieldCounter++;
                }
                else {
                    this.shields.children[0].remove();
                    this.shieldCounter = 0;
                    this.shieldFlag = false;
                }
            }
        }
    }

    // This handles dynamic resizing of the browser window
    // You do not need to modify this function
    private resize() : void
    {
        var aspectRatio = this.width / this.height;
        var newAspectRatio = paper.view.viewSize.width / paper.view.viewSize.height;
        if(newAspectRatio > aspectRatio)
            paper.view.zoom = paper.view.viewSize.width  / this.width;
        else
            paper.view.zoom = paper.view.viewSize.height / this.height;
        paper.view.center = new paper.Point(this.width / 2, this.height / 2);
    }

    private onMouseMove(event: paper.MouseEvent) : void
    {
        // Get the vector from the center of the screen to the mouse position
        this.mouseVector = event.point.subtract(paper.view.center);

        // Point the ship towards the mouse cursor by converting the vector to an angle
        // This only works if applyMatrix is set to false
        this.ship.rotation = this.mouseVector.angle + 90;
        this.shipInstance!.rotation = this.mouseVector.angle + 90;
    }

    private onMouseDown(event: paper.MouseEvent) : void
    {
        // console.log("Mouse click!");
        var laserBeam = this.laserGenerator!.place(paper.view.center);
        this.firedAmmo.addChild(laserBeam);
        this.firedAmmo.children[this.firedAmmo.children.length - 1].pivot = new paper.Point(0, 0);
        this.firedAmmo.children[this.firedAmmo.children.length - 1].scale(0.7, 0.5);
        this.firedAmmo.children[this.firedAmmo.children.length - 1].rotation = this.mouseVector.angle;
    }
}

// This is included because the paper is missing a TypeScript definition
// You do not need to modify it
class GameEvent
{
    readonly delta: number;
    readonly time: number;
    readonly count: number;

    constructor()
    {
        this.delta = 0;
        this.time = 0;
        this.count = 0;
    }
}
    
// Start the game
var game = new Game();
game.start();