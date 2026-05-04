const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const timeValue = document.getElementById('time-value');
const finalTime = document.getElementById('final-time');

// Assets
const images = {
    player: new Image(),
    sofa: new Image(),
    chair: new Image(),
    bgTile: new Image()
};

let assetsLoaded = 0;
const totalAssets = 4;

function removeBackground(img) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width || img.naturalWidth;
    tempCanvas.height = img.height || img.naturalHeight;
    if (tempCanvas.width === 0 || tempCanvas.height === 0) return img;

    const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    tCtx.drawImage(img, 0, 0);
    const imageData = tCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    
    const w = tempCanvas.width;
    const h = tempCanvas.height;
    const corners = [
        0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4
    ];
    
    const bgColors = [];
    corners.forEach(idx => {
        bgColors.push({r: data[idx], g: data[idx+1], b: data[idx+2]});
    });
    
    const tolerance = 45;

    for (let i = 0; i < data.length; i += 4) {
        if (data[i+3] === 0) continue;
        let r = data[i], g = data[i+1], b = data[i+2];
        let isBg = false;
        
        for (let c of bgColors) {
            if (Math.abs(r - c.r) < tolerance && 
                Math.abs(g - c.g) < tolerance && 
                Math.abs(b - c.b) < tolerance) {
                isBg = true; break;
            }
        }
        
        // Delete light grey and white (checkerboard patterns)
        if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && r > 180) {
            isBg = true;
        }

        if (isBg) {
            data[i+3] = 0;
        }
    }
    tCtx.putImageData(imageData, 0, 0);
    const newImg = new Image();
    newImg.src = tempCanvas.toDataURL();
    return newImg;
}

function processImage(imgObj, key) {
    if (key !== 'bgTile') {
        images[key] = removeBackground(imgObj);
    }
    assetsLoaded++;
    if (assetsLoaded === totalAssets) {
        console.log("All assets loaded");
        if (gameState === 'START') draw();
    }
}

images.player.onload = () => processImage(images.player, 'player');
images.sofa.onload = () => processImage(images.sofa, 'sofa');
images.chair.onload = () => processImage(images.chair, 'chair');
images.bgTile.onload = () => processImage(images.bgTile, 'bgTile');

images.player.src = 'assets/player_1777882665677.png';
images.sofa.src = 'assets/furniture_sofa_1777882684234.png';
images.chair.src = 'assets/furniture_chair_1777882703807.png';
images.bgTile.src = 'assets/bg_tile_1777882719333.png';

// Game State
let gameState = 'START'; // START, PLAYING, GAME_OVER
let lastTime = 0;
let surviveTime = 0;

// Input
const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
    }
});

// Entities
const player = {
    x: 400,
    y: 300,
    width: 60,
    height: 60,
    vx: 0,
    vy: 0,
    speed: 300, // pixels per second
    friction: 0.85
};

let furnitures = [];
let spawnTimer = 0;
let spawnInterval = 1.5; // seconds

let bgOffset = { x: 0, y: 0 };

function initGame() {
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height / 2 - player.height / 2;
    player.vx = 0;
    player.vy = 0;
    
    furnitures = [];
    surviveTime = 0;
    spawnTimer = 0;
    spawnInterval = 2.0; // Start easier
    
    gameState = 'PLAYING';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function spawnFurniture() {
    // 0: top, 1: right, 2: bottom, 3: left
    const side = Math.floor(Math.random() * 4);
    const type = Math.random() > 0.5 ? 'sofa' : 'chair';
    
    let width = type === 'sofa' ? 120 : 60;
    let height = type === 'sofa' ? 70 : 60;
    
    let x, y, vx, vy;
    const speed = 150 + Math.random() * 100 + (surviveTime * 2); // gets faster over time
    
    if (side === 0) { // Top
        x = Math.random() * (canvas.width - width);
        y = -height;
        vx = 0;
        vy = speed;
    } else if (side === 1) { // Right
        x = canvas.width;
        y = Math.random() * (canvas.height - height);
        // rotate dimensions for horizontal move if sofa
        if(type === 'sofa') { width = 70; height = 120; }
        vx = -speed;
        vy = 0;
    } else if (side === 2) { // Bottom
        x = Math.random() * (canvas.width - width);
        y = canvas.height;
        vx = 0;
        vy = -speed;
    } else { // Left
        x = -width;
        y = Math.random() * (canvas.height - height);
        if(type === 'sofa') { width = 70; height = 120; }
        vx = speed;
        vy = 0;
    }
    
    furnitures.push({ x, y, width, height, vx, vy, type });
}

function checkCollision(r1, r2) {
    return r1.x < r2.x + r2.width &&
           r1.x + r1.width > r2.x &&
           r1.y < r2.y + r2.height &&
           r1.y + r1.height > r2.y;
}

function gameOver() {
    gameState = 'GAME_OVER';
    finalTime.innerText = surviveTime.toFixed(1);
    gameOverScreen.classList.remove('hidden');
}

function update(dt) {
    if (gameState !== 'PLAYING') return;

    surviveTime += dt;
    timeValue.innerText = surviveTime.toFixed(1);
    
    // Background movement (Jamiroquai floor illusion)
    bgOffset.x -= 30 * dt;
    bgOffset.y += 10 * dt;
    if(bgOffset.x <= -images.bgTile.width) bgOffset.x = 0;
    if(bgOffset.y >= images.bgTile.height) bgOffset.y = 0;

    // Player Movement (Acceleration based)
    let ax = 0;
    let ay = 0;
    
    if (keys.w || keys.ArrowUp) ay -= 1;
    if (keys.s || keys.ArrowDown) ay += 1;
    if (keys.a || keys.ArrowLeft) ax -= 1;
    if (keys.d || keys.ArrowRight) ax += 1;
    
    // Normalize acceleration
    if (ax !== 0 && ay !== 0) {
        const length = Math.sqrt(ax * ax + ay * ay);
        ax /= length;
        ay /= length;
    }
    
    player.vx += ax * player.speed * dt * 5;
    player.vy += ay * player.speed * dt * 5;
    
    // Apply friction (sliding feel)
    player.vx *= player.friction;
    player.vy *= player.friction;
    
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    
    // Furniture Spawning
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
        spawnTimer = 0;
        spawnFurniture();
        // Decrease interval over time, min 0.5s
        spawnInterval = Math.max(0.5, spawnInterval - 0.05); 
    }
    
    // Update Furnitures
    for (let i = furnitures.length - 1; i >= 0; i--) {
        let f = furnitures[i];
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        
        // Remove off-screen furnitures (with some margin)
        if (f.x < -300 || f.x > canvas.width + 300 || f.y < -300 || f.y > canvas.height + 300) {
            furnitures.splice(i, 1);
            continue;
        }
    }
    
    // Collision and Pushing
    // Player vs Furniture
    let pushed = false;
    for (let f of furnitures) {
        if (checkCollision(player, f)) {
            pushed = true;
            
            // Calculate overlap on each axis
            let overlapLeft = (player.x + player.width) - f.x;
            let overlapRight = (f.x + f.width) - player.x;
            let overlapTop = (player.y + player.height) - f.y;
            let overlapBottom = (f.y + f.height) - player.y;
            
            // Find the smallest overlap to determine collision direction
            let minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
            
            // Push player out
            if (minOverlap === overlapLeft) player.x = f.x - player.width;
            else if (minOverlap === overlapRight) player.x = f.x + f.width;
            else if (minOverlap === overlapTop) player.y = f.y - player.height;
            else if (minOverlap === overlapBottom) player.y = f.y + f.height;
            
            // Add momentum from furniture
            player.vx = f.vx * 0.5;
            player.vy = f.vy * 0.5;
        }
    }
    
    // Check if player is pushed out of bounds (Crushed against wall)
    if (player.x < 0 || player.x + player.width > canvas.width || 
        player.y < 0 || player.y + player.height > canvas.height) {
        
        // If pushed is true, it means they were pushed into the wall by furniture
        if (pushed) {
            gameOver();
        } else {
            // Just block player from going out normally
            if (player.x < 0) player.x = 0;
            if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
            if (player.y < 0) player.y = 0;
            if (player.y + player.height > canvas.height) player.y = canvas.height - player.height;
        }
    }
    
    // Check if player is crushed between two furnitures
    if (pushed) {
        for (let f of furnitures) {
             if (checkCollision(player, f)) {
                 // After resolving one collision, if still colliding, player is crushed
                 gameOver();
                 break;
             }
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Background Tile
    if (images.bgTile.complete && images.bgTile.naturalWidth > 0) {
        const w = images.bgTile.width;
        const h = images.bgTile.height;
        for (let x = (bgOffset.x % w) - w; x < canvas.width; x += w) {
            for (let y = (bgOffset.y % h) - h; y < canvas.height; y += h) {
                ctx.drawImage(images.bgTile, x, y, w, h);
            }
        }
    } else {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Sort entities by Y for pseudo depth (optional, but looks better)
    let renderList = [...furnitures, player].sort((a, b) => (a.y + a.height) - (b.y + b.height));
    
    // Draw Shadows
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (let ent of renderList) {
        ctx.beginPath();
        ctx.ellipse(ent.x + ent.width/2, ent.y + ent.height, ent.width/2.5, ent.height/6, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw Entities
    for (let ent of renderList) {
        if (ent === player) {
            if (images.player.complete) {
                ctx.drawImage(images.player, player.x, player.y, player.width, player.height);
            } else {
                ctx.fillStyle = 'blue';
                ctx.fillRect(player.x, player.y, player.width, player.height);
            }
        } else {
            let img = ent.type === 'sofa' ? images.sofa : images.chair;
            if (img.complete) {
                // If it's a sofa moving vertically, we need to draw it rotated (if we want, but let's just stretch or use square/rect)
                // For simplicity, we just draw the image scaled to the width/height we defined
                // To rotate properly, we'd use ctx.save() ctx.translate() ctx.rotate() ctx.restore()
                
                ctx.save();
                ctx.translate(ent.x + ent.width/2, ent.y + ent.height/2);
                
                // If width < height for sofa, it means it's moving horizontally
                if (ent.type === 'sofa' && ent.width < ent.height) {
                    ctx.rotate(Math.PI / 2);
                    ctx.drawImage(img, -ent.height/2, -ent.width/2, ent.height, ent.width);
                } else {
                    ctx.drawImage(img, -ent.width/2, -ent.height/2, ent.width, ent.height);
                }
                ctx.restore();
                
            } else {
                ctx.fillStyle = 'black';
                ctx.fillRect(ent.x, ent.y, ent.width, ent.height);
            }
        }
    }
}

function gameLoop(time) {
    const dt = (time - lastTime) / 1000;
    lastTime = time;
    
    // Cap dt to prevent huge jumps if tab is inactive
    if (dt < 0.1) {
        update(dt);
    }
    draw();
    
    if (gameState === 'PLAYING') {
        requestAnimationFrame(gameLoop);
    }
}

startBtn.addEventListener('click', initGame);
restartBtn.addEventListener('click', initGame);

// Initial draw
images.player.onload = () => { draw(); };
