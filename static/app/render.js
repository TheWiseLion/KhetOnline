/**
 * Container For All Rendering & Animating Logic
 *
 *
 */

//Support Board Pieces ()
angular.module('myApp').controller('GameController', function($scope,$window,$interval,khetService){
    console.log("New Game Controller - "+$scope.$parent.ctrl.id);

    var ctrl = {};
    ctrl.id = $scope.$parent.ctrl.id;
    ctrl.moving = false;
    ctrl.renderMoves = [];
    ctrl.movingSquare = null;
    ctrl.drawDifferentlyRotated = null;
    ctrl.mouseOverImages = new Map();



    //Load All Images
    var base = "static/img/game/";
    // All Images Are YxY
    var ankh = new createjs.Bitmap(base+"ankh.png");
    var anubis = new createjs.Bitmap(base+"anubis.png");
    var anubisIcon = new createjs.Bitmap(base+"AnubisIcon.png");
    var pharaoh = new createjs.Bitmap(base+"square.png");
    var pharaohIcon = new createjs.Bitmap(base+"PharaohIcon.png");
    var eye = new createjs.Bitmap(base+"horuseye.png");
    var scarab = new createjs.Bitmap(base+"scarab.png");
    var scarabStatic = new createjs.Bitmap(base+"scarabStatic.png");
    var sphinx = new createjs.Bitmap(base+"SphinxSquare.png");
    var sphinxFace = new createjs.Bitmap(base+"SphinxIcon.png");
    var pyramid = new createjs.Bitmap(base+"pyramid.png");
    var counterClockwise = new createjs.Bitmap(base+"counterclockwise.png");
    var clockwise = new createjs.Bitmap(base+"clockwise.png");
    var arrow = new createjs.Bitmap(base+"arrow.png");

    var images = [
        ankh, anubis, anubisIcon, pharaoh, pharaohIcon, eye, scarab, scarabStatic,
        sphinx, sphinxFace, pyramid, counterClockwise, clockwise, arrow
    ];

    ctrl.imageCount = 0;
    function onLoad () {
        ctrl.imageCount += 1;
        if(ctrl.draw != null && ctrl.imageCount == images.length){
            ctrl.draw();
        }
        console.log(ctrl.imageCount +" loaded");
    }
    images.forEach(function(e){
        e.image.onload = onLoad;
    });




    var imageSize = 150;
    var strokeWidth = 5;
    var padding = 5;
    var fullScale = 10 * (padding + strokeWidth +imageSize);
    var stage = new createjs.Stage("gameCanvas");
    var container = new createjs.Container();
    stage.addChild(container);




    var baseAlpha = .35;
    var hoverAlpha = .70;
    var mouseOver = function (event) {
        //When Hovered Draw Rotated (because it can be confusing for players)
        //TODO: Draw Event's Related Image (move.type == rotation)
        event.target.alpha = (event.type == "mouseover") ?  hoverAlpha : baseAlpha;
        var img = ctrl.mouseOverImages.get(event.target.name);
        if(img != null){
            var alpha = (event.type == "mouseover") ? 1 : 0;
            var alpha2 = (event.type == "mouseover") ? .75 : 0;
            img.images.forEach(function (e) {e.alpha = alpha2});
            img.background.alpha = alpha;
        }
        stage.update();
        event.stopPropagation();
    };

    var squareListener = function(event) {
        ctrl.onClick(event.target.name.x, event.target.name.y);
        event.stopPropagation();
    };

    var moveListener = function (event) {
        ctrl.onClickMove(event.target.name);
        event.stopPropagation();
    };




    // Canvas Resizing Logic
    // Base Width: 1300  (130 per block)
    // Base Height: 1080 (130 per block)
    // Aspect Ratio -> (10 x 8)

    //Clicks on board (not moves) come here
    ctrl.onClick = function (x, y) {
        //Basically If you already clicked on a movable piece it'll switch to the new piece you want to move
        var change = ctrl.moving != false;
        ctrl.moving = false;
        //noinspection JSUnresolvedVariable
        if($scope.$parent.ctrl.side == $scope.$parent.game.movingPlayer){
            // console.log("I can move as "+$scope.$parent.ctrl.side);
            if ($scope.$parent.moves[x] != null && $scope.$parent.moves[x][y] != null){

                ctrl.renderMoves = $scope.$parent.moves[x][y];
                ctrl.movingSquare = {x:x,y:y};
                ctrl.moving = true;
                change = true;
            }
        }

        // Only Redraw if we actually did something that warrants it....
        if (change){
            ctrl.draw();
        }

    };

    //Clicks on a "shown" move come here.
    ctrl.onClickMove= function(move){
        // console.log("Move Listener");
        // console.log(move);
        ctrl.moving = false;
        ctrl.renderMoves = null;
        ctrl.movingSquare = null;

        $scope.$parent.applyMove(move);
        // ctrl.draw();
    };

    ctrl.drawMove = function (move) {
        // console.log("Draw move");
        // console.log(move);
        var moveImages = [];
        var rollImages = [];
        var size = (imageSize+strokeWidth) * ctrl.scale;
        var x = -1;
        var y = -1;
        var offSetX = ctrl.scale * 5* 10 / 2.0;
        var offSetY = ctrl.scale * 5 * 8 / 2.0;


        var square = new createjs.Shape();
        square.name= move;

        if(move.type == "ROTATE"){
            var sizeFactor = .35;
            var offSetFactor = (.5 - sizeFactor/2);
            x = move.position.x * size + offSetX;
            y = move.position.y * size + offSetY;
            size = (imageSize+strokeWidth) * ctrl.scale * sizeFactor;
            var type = $scope.$parent.board[move.position.x][move.position.y].type;
            var current = $scope.$parent.board[move.position.x][move.position.y].orientation;
            if(move.value == 0){
                offSetX = offSetFactor * (imageSize+strokeWidth) * ctrl.scale;
                offSetY = 0;
            }else if(move.value == 90){
                offSetX = (imageSize+strokeWidth) * ctrl.scale - size;
                offSetY = offSetFactor * (imageSize+strokeWidth) * ctrl.scale;
            }else if(move.value == 180){
                offSetX = offSetFactor * (imageSize+strokeWidth) * ctrl.scale;
                offSetY = (imageSize+strokeWidth) * ctrl.scale - size;
            }else if(move.value == 270){
                offSetX = 0;
                offSetY = offSetFactor * (imageSize+strokeWidth) * ctrl.scale;
            }

            var bitmap;
            var faced = type == 'sphinx' || type == 'anubis' || type == 'pharaoh';
            var img = clockwise;
            if(faced){
                bitmap = arrow.clone(true);
                bitmap.rotation = move.value;
            }else{ // Things that we need to show orientation
                var diff = Math.max(current, move.value) - Math.min(current, move.value);
                var isMax = Math.max(current, move.value) == current;
                // Is it CCW or CW
                if ((diff > 90 && current==0)||(isMax && diff<=90)){
                    img = counterClockwise;
                    offSetX = 0;
                    offSetY = offSetFactor * (imageSize+strokeWidth) * ctrl.scale;
                }else {
                    img = clockwise;
                    offSetX = (imageSize+strokeWidth) * ctrl.scale - size;
                    offSetY = offSetFactor * (imageSize+strokeWidth) * ctrl.scale;
                }

                bitmap = img.clone(true);

            }

            //Add Mouse Over Image:
            var bg = ctrl.drawEmptySquare(move.position.x, move.position.y, '#FFFFFF');
            var piece = {position: move.position, piece: {type: type, orientation: move.value}};
            var images = ctrl.drawPiece(piece);
            ctrl.mouseOverImages.set(move, {images: images, background: bg});
            ctrl.mouseOverImages.get(move).background.alpha = 0;
            ctrl.mouseOverImages.get(move).images.forEach(function (e) {e.alpha = 0});
            // rollImages.push(bg);
            rollImages.push.apply(rollImages, images);


            bitmap.scaleX = size / imageSize;
            bitmap.scaleY = size / imageSize;
            bitmap.x = x + offSetX;
            bitmap.y = y + offSetY;

            if(faced){
                if(move.value==90){
                    bitmap.x += size;
                }else if( move.value==180) {
                    bitmap.x += size;
                    bitmap.y += size;
                }else if(move.value==270){
                    bitmap.y += size;
                }
            }


            moveImages.push(bitmap);
        }else if(move.type == "SWAP" || move.type == "MOVE"){
            x =  move.value.x * size;
            y =  move.value.y * size;
        }

        // Draw Hover Square:
        square.x = x + offSetX;
        square.y = y + offSetY;
        square.graphics.beginFill('#2DB50E').drawRect(0, 0, size, size);
        // square.alpha = .25;
        square.hitArea = new createjs.Shape();
        square.hitArea.graphics.beginFill('#000').drawRect(0,0, size, size).endFill();
        square.addEventListener('click', moveListener);
        square.alpha = baseAlpha;
        //Add Hover Alpha Changer
        square.addEventListener("mouseover", mouseOver);
        square.addEventListener("mouseout", mouseOver);
        moveImages.push(square);

        return {rollImages: rollImages, moves: moveImages}
    };

    ctrl.drawImage=function(image, x, y, rotation){
        if(rotation === undefined){rotation=0;}

        var offSetX = ctrl.scale * 5* 10 / 2.0;
        var offSetY = ctrl.scale * 5 * 8 / 2.0;
        var strokeOffSet = strokeWidth* ctrl.scale/2.0;
        var size = (imageSize+strokeWidth) * ctrl.scale;

        var bitmap =image.clone(true);
        bitmap.scaleX = ctrl.scale;
        bitmap.scaleY = ctrl.scale;
        bitmap.x = x * size + offSetX + strokeOffSet;
        bitmap.y = y * size + offSetY + strokeOffSet;
        if(rotation==90){
            bitmap.x += ctrl.scale*imageSize;
        }else if( rotation==180) {
            bitmap.x += ctrl.scale*imageSize;
            bitmap.y += ctrl.scale*imageSize;
        }else if(rotation==270){
            bitmap.y += ctrl.scale*imageSize;
        }

        bitmap.rotation = rotation;
        bitmap.cache(0,0, imageSize,imageSize, ctrl.scale);

        return bitmap;
    };

    ctrl.drawPiece=function (data, shiftFilter) {
        var image = null;
        var image2 = null;
        var piece = data.piece;
        var orientation = piece.orientation;
        switch (piece.type){
            case "sphinx":
                image = sphinx;
                image2 = sphinxFace;
                break;
            case "pyramid":
                image = pyramid;
                break;
            case "scarab":
                image = scarab;
                image2 = scarabStatic;
                break;
            case "anubis":
                image = anubis;
                image2 = anubisIcon;
                break;
            case "pharaoh":
                image = pharaoh;
                image2 = pharaohIcon;
                break;
        }

        // White is 255 so we have to substract the difference
        var redFilter = new createjs.ColorFilter(1,1,1,1, 193-255,12-255, 6-255,0);
        var silverFilter = new createjs.ColorFilter(1,1,1,1, 192-255, 192-255, 192-255,0);
        var filter = piece.color == 'red'? redFilter: silverFilter;
        if(shiftFilter !== undefined){
            filter = new createjs.ColorFilter(1,1,1,1, shiftFilter[0]-255,shiftFilter[1]-255,shiftFilter[2]-255)
        }

        var images = [];
        if(image != null){
            var coloredImage = image.clone(true);
            coloredImage.filters = [filter];

            //color the image with the team color
            images.push(ctrl.drawImage(coloredImage, data.position.x, data.position.y, orientation));
        }

        // If the piece has a face draw it unrotated
        if(image2 != null){
            images.push(ctrl.drawImage(image2, data.position.x, data.position.y));

        }


        return images;
    };

    ctrl.drawSquareSide=function(image, x, y){
        if ($scope.$parent.board == null || $scope.$parent.board[x] == null || $scope.$parent.board[x][y] == null){
            container.addChild(ctrl.drawImage(image,x,y));
        }
    };

    ctrl.drawEmptySquare = function (x, y, color) {
        if(color == undefined){
            color = '#000';
        }


        var offSetX = ctrl.scale * 5* 10 / 2.0;
        var offSetY = ctrl.scale * 5 * 8 / 2.0;

        var size = (imageSize+strokeWidth) * ctrl.scale;
        var square = new createjs.Shape();

        square.name= {x: x, y: y};
        square.x = x * size + offSetX;
        square.y = y * size + offSetY;
        square.graphics.drawRect(0, 0, size, size);

        square.hitArea = new createjs.Shape();
        square.hitArea.graphics.beginFill(color).drawRect(0,0, size, size).endFill();


        square.addEventListener('click', squareListener);

        return square;
    };

    ctrl.drawLine = function (p1, p2, color, dotted) {
        var size = (imageSize+strokeWidth) * ctrl.scale;
        var offSetX = ctrl.scale * 5* 10 / 2.0 + size/2.0;
        var offSetY = ctrl.scale * 5 * 8 / 2.0 + size/2.0;

        var p1_actual = {x: p1.x*size+offSetX, y: p1.y * size + offSetY};
        var p2_actual = {x: p2.x*size+offSetX, y: p2.y * size + offSetY};


        var line = new createjs.Shape();
        line.graphics.setStrokeStyle(3);
        line.graphics.beginStroke(color);
        if(dotted){
            //15% line gap
            var lineGap = .25;
            var dashes = 2;
            var lineFactor = (1.0 - lineGap)/dashes;
            var diffX = (p2_actual.x - p1_actual.x);
            var diffY = (p2_actual.y - p1_actual.y);
            line.graphics.moveTo(p1_actual.x, p1_actual.y);

            for(var i=0; i<dashes; i++){
                line.graphics.lineTo(p1_actual.x + (i+1)*diffX*lineFactor, p1_actual.y + (i+1)*diffY*lineFactor);
                line.graphics.moveTo(p1_actual.x + (i+1)*diffX/dashes, p1_actual.y + (i+1)*diffY/dashes);
            }

            line.graphics.lineTo(p2_actual.x, p2_actual.y);
        }else{
            line.graphics.moveTo(p1_actual.x, p1_actual.y);
            line.graphics.lineTo(p2_actual.x, p2_actual.y);
        }


        line.graphics.endStroke();


        var star = new createjs.Shape();
        star.graphics.beginFill(color);
        star.graphics.drawPolyStar(0, 0, size *.2, 8, .6, -90);
        star.x = p1_actual.x;
        star.y = p1_actual.y;


        createjs.Ticker.addEventListener("tick",function tick(event) {
            var towardsP2 = true;
            if(p1.x > p2.x){
                towardsP2 = false;
            }else if(p1.y > p2.y){
                towardsP2 = false
            }

            // move 100 pixels per second (elapsedTimeInMS / 1000msPerSecond * pixelsPerSecond):
            var timeToCycle = 2000.0;
            var delta = (createjs.Ticker.getTime()%timeToCycle)/timeToCycle; // 2 seconds to animate the entire length...
            var diffX = (p2_actual.x - p1_actual.x) * delta;
            var diffY = (p2_actual.y - p1_actual.y) * delta;

            if(towardsP2){
                star.x = p1_actual.x + diffX;
                star.y = p1_actual.y + diffY;

            }else{
                star.x = p1_actual.x + diffX;
                star.y = p1_actual.y + diffY;
            }

        });
        //Add a listener to animate the dots..
        // createjs.Ticker.addEventListener("tick", tick);

        return [line, star];
    };

    ctrl.draw = function(){
        var offSetX = ctrl.scale * 5* 10 / 2.0;
        var offSetY = ctrl.scale * 5 * 8 / 2.0;
        ctrl.mouseOverImages = new Map();

        container.removeAllChildren();
        for (var x = 0; x < 10; x++)
        {
            for (var y = 0; y < 8; y++)
            {
                var size = (imageSize+strokeWidth) * ctrl.scale;
                var square = new createjs.Shape();
                square.graphics.beginStroke("black");

                square.graphics.drawRect(0, 0, size, size);

                square.x = x * size + offSetX;
                square.y = y * size + offSetY;
                container.addChild(square);

            }
        }


        // Draw Horus & Anhks
        for (var y=0; y<8; y++){
            ctrl.drawSquareSide(ankh, 0,y);
        }
        ctrl.drawSquareSide(ankh,8,0);
        ctrl.drawSquareSide(ankh,8,7);
        for (var y=0; y<8; y++){
            ctrl.drawSquareSide(eye, 9,y);
        }
        ctrl.drawSquareSide(eye,1,0);
        ctrl.drawSquareSide(eye,1,7);



        //Draw Animated Laser
        //Draw dotted laser iff both lasers are drawn & laser is not the color that is moving
        if($scope.$parent.game && $scope.$parent.silverLaser){
            var silverPath =  $scope.$parent.silverLaser;
            var dotted = $scope.$parent.redLaser && $scope.$parent.game.movingPlayer=='red';
            var pathLen = silverPath.length;

            var line = ctrl.drawLine({x: 0, y: 0}, silverPath[0].position, 'red');
            line.forEach(function(e){container.addChild(e)});

            for (var i = 1; i < pathLen; i++) {
                var p1 = silverPath[i-1].position;
                var p2 = silverPath[i].position;
                var line = ctrl.drawLine(p1, p2, 'red', dotted);
                line.forEach(function(e){container.addChild(e)});
            }
        }

        if($scope.$parent.game && $scope.$parent.redLaser){
            var redPath = $scope.$parent.redLaser;
            var pathLen = redPath.length;
            var dotted = $scope.$parent.silverLaser && $scope.$parent.game.movingPlayer=='silver';

            var line = ctrl.drawLine({x: 9, y: 7}, redPath[0].position, 'red');
            line.forEach(function(e){container.addChild(e)});

            for (var i = 1; i < pathLen; i++) {
                var p1 = redPath[i-1].position;
                var p2 = redPath[i].position;
                var line = ctrl.drawLine(p1, p2, 'red', dotted);
                line.forEach(function(e){container.addChild(e)});
            }
        }


        //Draw All The Game Pieces
        if($scope.$parent.boardPieces != null){
            $scope.$parent.boardPieces.forEach(function(element) {
                ctrl.drawPiece(element).forEach(function(e) { container.addChild(e) });
            });
        }



        // Add Mouse Sensors
        for (var x = 0; x < 10; x++)
        {
            for (var y = 0; y < 8; y++)
            {
                container.addChild(ctrl.drawEmptySquare(x,y));
            }
        }


        // TODO: Add Move Sensors (Click, Hover)
        if(ctrl.moving){
            // console.log("Render Move");
            // console.log(ctrl.movingSquare);
            // Draw highlighted square
            var size = (imageSize+strokeWidth) * ctrl.scale;
            var square = new createjs.Shape();
            square.name= {x: ctrl.movingSquare.x, y: ctrl.movingSquare.y};
            square.x = ctrl.movingSquare.x * size + offSetX;
            square.y = ctrl.movingSquare.y * size + offSetY;
            square.graphics.beginFill('#FF6533').drawRect(0, 0, size, size);
            // square.alpha = .25;
            square.hitArea = new createjs.Shape();
            square.hitArea.graphics.beginFill('#000').drawRect(0,0, size, size).endFill();
            square.addEventListener('click', squareListener);
            square.alpha = 0.5;
            container.addChild(square);

            var rollImages = [];
            var overlayImages = [];

            ctrl.renderMoves.forEach(function (element) {
               var result = ctrl.drawMove(element);
                rollImages.push.apply(rollImages, result.rollImages);
                overlayImages.push.apply(overlayImages , result.moves);
            });

            rollImages.forEach(function(e) { container.addChild(e) });
            overlayImages.forEach(function(e) { container.addChild(e) });

        }

        container.hitArea = new createjs.Shape();
        container.hitArea.graphics.beginFill('#000').drawRect(0,0,stage.canvas.width,stage.canvas.height).endFill();
        stage.update();
    };

    ctrl.clickBug = 0;
    container.addEventListener('click', function(event) {
        var child = container.getObjectUnderPoint(event.stageX, event.stageY);
        if (child && child != container && ctrl.clickBug < 11) {
            // Call Square Listener
            ctrl.clickBug += 1;
            child.dispatchEvent(event);
        }

        if(ctrl.clickBug > 10){
            console.log("Click Bug:");
            console.log(event);
            console.log(child);


        }

        event.stopPropagation();
        ctrl.clickBug = 0;
    });

    //Nifty Hack To Propagate mouseout / mouseover events to children in a container.

    stage.addEventListener('stagemousemove', function(event) {
        var child = container.getObjectUnderPoint(event.stageX, event.stageY);
        if (child && child != container) {
            //First Time We've Encountered
            // if(ctrl.rolledOn[child] == null){
            event.type = 'mouseover';
            child.dispatchEvent(event);
            // }


        }

        event.type = 'mouseout';
        for(var index in ctrl.rolledOn) {
            if (ctrl.rolledOn.hasOwnProperty(index)) {
                var element = ctrl.rolledOn[index];
                if(element != child){
                    element.dispatchEvent(event);
                }
            }
        }


        ctrl.rolledOn = {};
        if (child != null){
            ctrl.rolledOn[child] = child;
        }

        event.stopPropagation();
    });

    //Resize
    ctrl.resize=function(){
        console.log("Resize Event");
        var windowHeight = Math.min(Math.max(.60*(window.innerHeight/725.0), .6),.70);
        console.log("Window Height Scale: "+windowHeight);
        var maxWidth;
        if (window.innerWidth > 500){
            maxWidth = .6666 * window.innerWidth;
        }else{
            maxWidth = window.innerWidth;
        }
        var maxHeight = window.innerHeight;


        console.log("H: "+ maxHeight+" W: "+maxWidth);
        // Determine if the window is width or height limited:
        if(maxWidth > maxHeight*windowHeight){
            //Height Limited
            stage.canvas.height = maxHeight*windowHeight;
            stage.canvas.width  =  (stage.canvas.height * 10)/8;

        }else{
            //Width Limited
            stage.canvas.width  =  maxWidth;
            stage.canvas.height = (stage.canvas.width * 8)/10;
        }

        ctrl.scale = stage.canvas.width/fullScale;
        console.log(stage.canvas.width +", "+stage.canvas.height);
        ctrl.draw();
    };

    // Set Initial Width
    ctrl.resize();

    container.mouseChildren = true;

    //Draw Once? Or something else perhaps...
    ctrl.drawOnce = false;
    $interval(function () {
        if(!ctrl.drawOnce){
            ctrl.draw();
            ctrl.drawOnce = true;
        }

    },1000);
    stage.enableMouseOver(20);
    $window.addEventListener('resize', ctrl.resize, false);

    //Watch Move Counter (update if changes)
    //Watch Show Red Laser (update if changes)
    //Watch Show Silver Laser (update if changes)
    $scope.$parent.$watch('ctrl.moveIndex', function(index){
        console.log("Move index changed");
        ctrl.draw();
    });

    createjs.Ticker.addEventListener("tick",function tick(event) {
        // console.log( createjs.Ticker.getTime()%1000.0);
        // console.log( createjs.Ticker.getTime());
        stage.update();
    });

    createjs.Ticker.setFPS(30);
    // createjs.Ticker.timingMode = createjs.Ticker.RAF_SYNCHED
});