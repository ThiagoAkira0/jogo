/**
 * Project Shadow Strike - Core Engine
 */

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 1280;
        this.canvas.height = 720;

        this.entities = [];
        this.player = null;
        this.enemies = [];
        this.projectiles = [];
        this.drops = [];

        this.keys = {};
        this.justPressed = {};
        this.lastTime = 0;

        // Progression
        this.kills = 0;
        this.enemyScalingFactor = 1.0;
        this.playerLevel = 1;
        this.playerXP = 0;
        this.xpToNextLevel = 100;

        // Image Assets
        this.assets = {
            player: new Image(),
            enemy: new Image(),
            bg: new Image()
        };
        this.assets.player.crossOrigin = "anonymous";
        this.assets.enemy.crossOrigin = "anonymous";

        this.assets.player.src = 'player.png';
        this.assets.enemy.src = 'enemy.png';
        this.assets.bg.src = 'bg.png';

        // Process images once loaded to remove background
        this.assets.player.onload = () => this.assets.player = this.removeBackground(this.assets.player);
        this.assets.enemy.onload = () => this.assets.enemy = this.removeBackground(this.assets.enemy);

        this.particles = [];
        this.shakeTimer = 0;
        this.shakeIntensity = 0;

        this.isGameOver = false;

        this.init();
    }

    init() {
        this.bindEvents();
        this.spawnPlayer();
        this.spawnEnemy();

        requestAnimationFrame(this.loop.bind(this));
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            if (!this.keys[e.code]) this.justPressed[e.code] = true;
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }

    spawnPlayer() {
        this.player = new Player(this);
        this.entities.push(this.player);
    }

    spawnEnemy() {
        const enemy = new Enemy(this);
        this.enemies.push(enemy);
        this.entities.push(enemy);
    }

    loop(timestamp) {
        if (this.isGameOver) return;

        const deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw();

        requestAnimationFrame(this.loop.bind(this));
    }

    update(deltaTime) {
        // Update all entities
        this.entities.forEach(entity => entity.update(deltaTime));

        // Clean up dead entities
        this.entities = this.entities.filter(e => !e.toRemove);
        this.enemies = this.enemies.filter(e => !e.toRemove);
        this.projectiles = this.projectiles.filter(p => !p.toRemove);
        this.drops = this.drops.filter(e => !e.toRemove);

        // Respawn enemy if none left
        if (this.enemies.length === 0) {
            this.spawnEnemy();
        }

        // Progression scaling logic
        if (this.kills > 0 && this.kills % 5 === 0 && this.recentKillCount !== this.kills) {
            this.enemyScalingFactor += 0.1;
            this.recentKillCount = this.kills;
        }

        // UI Updates
        this.updateHUD();

        // Update particles
        this.particles.forEach(p => p.update(deltaTime));
        this.particles = this.particles.filter(p => p.life > 0);

        // Update Screen Shake
        if (this.shakeTimer > 0) {
            this.shakeTimer -= deltaTime;
        } else {
            this.shakeIntensity = 0;
        }

        // Clear justPressed for next frame
        this.justPressed = {};
    }

    screenShake(intensity = 10, duration = 0.2) {
        this.shakeIntensity = intensity;
        this.shakeTimer = duration;
    }

    spawnParticles(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    removeBackground(img) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Take the top-left pixel as the background color (usually)
        const br = data[0];
        const bg = data[1];
        const bb = data[2];

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Removing white, light gray, and nearly-white backgrounds (common checkers)
            const isWhite = r > 220 && g > 220 && b > 220;
            const isLightGray = (r > 180 && g > 180 && b > 180) && (Math.abs(r - g) < 15 && Math.abs(g - b) < 15);

            if (isWhite || isLightGray) {
                data[i + 3] = 0;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        const newImg = new Image();
        newImg.src = canvas.toDataURL();
        return newImg;
    }

    updateHUD() {
        document.getElementById('player-health').style.width = `${(this.player.hp / this.player.maxHp) * 100}%`;
        document.getElementById('player-xp').style.width = `${(this.playerXP / this.xpToNextLevel) * 100}%`;
        document.getElementById('player-level').innerText = this.playerLevel;

        const enemy = this.enemies[0];
        if (enemy) {
            document.getElementById('enemy-hud').classList.remove('hidden');
            document.getElementById('enemy-health').style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
        } else {
            document.getElementById('enemy-hud').classList.add('hidden');
        }

        // Show/Hide Special Hint based on level
        if (this.playerLevel >= 2) {
            document.getElementById('hint-L').classList.remove('hidden');
            if (this.playerLevel >= 6) {
                document.getElementById('label-L').innerText = "GRAVITY";
            } else if (this.playerLevel >= 4) {
                document.getElementById('label-L').innerText = "SWEEP";
            } else {
                document.getElementById('label-L').innerText = "UPPERCUT";
            }
        }
    }

    addXP(amount) {
        this.playerXP += amount;
        if (this.playerXP >= this.xpToNextLevel) {
            this.levelUp();
        }
    }

    levelUp() {
        this.playerXP -= this.xpToNextLevel;
        this.playerLevel++;
        this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.2);

        // Healing on level up
        this.player.heal(20);

        // Unlock notification
        this.showUnlock(this.playerLevel);
    }

    showUnlock(level) {
        const moves = {
            2: "UPPERCUT (L)",
            4: "SWEEP (L)",
            6: "GRAVITY IMPACT (L)"
        };

        if (moves[level]) {
            const toast = document.getElementById('move-unlock-toast');
            document.getElementById('unlocked-move-name').innerText = moves[level];
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 3000);
        }
    }

    onEnemyKilled() {
        this.kills++;
        this.addXP(40);

        // Healing Drop Chance (20%)
        if (Math.random() < 0.2) {
            this.spawnDrop(this.enemies[0].x, this.enemies[0].y);
        }
    }

    spawnDrop(x, y) {
        const drop = new Drop(this, x, y);
        this.entities.push(drop);
        this.drops.push(drop);
    }

    draw() {
        this.ctx.save();

        // Apply Screen Shake
        if (this.shakeTimer > 0) {
            const dx = (Math.random() - 0.5) * this.shakeIntensity;
            const dy = (Math.random() - 0.5) * this.shakeIntensity;
            this.ctx.translate(dx, dy);
        }

        // Draw Background image
        this.ctx.drawImage(this.assets.bg, 0, 0, this.canvas.width, this.canvas.height);

        // Dark overlay for extra mood
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw entities
        this.entities.forEach(entity => entity.draw(this.ctx));

        // Draw particles
        this.particles.forEach(p => p.draw(this.ctx));

        this.ctx.restore();
    }

    gameOver() {
        this.isGameOver = true;
        document.getElementById('game-over').classList.remove('hidden');
        document.getElementById('final-kills').innerText = this.kills;
    }
}

/**
 * Entity Base class
 */
class Entity {
    constructor(game) {
        this.game = game;
        this.x = 0;
        this.y = 0;
        this.width = 60;
        this.height = 100;
        this.vx = 0;
        this.vy = 0;
        this.color = 'white';
        this.toRemove = false;
        this.grounded = false;
    }

    update(deltaTime) {
        // Gravity
        if (!this.grounded) {
            this.vy += 1500 * deltaTime;
        }

        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;

        // Ground collision
        if (this.y + this.height > 600) {
            this.y = 600 - this.height;
            this.vy = 0;
            this.grounded = true;
        } else {
            this.grounded = false;
        }

        // Bounds
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > 1280) this.x = 1280 - this.width;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Player extends Entity {
    constructor(game) {
        super(game);
        this.x = 200;
        this.y = 500;
        this.color = '#00f2ff';
        this.maxHp = 100;
        this.hp = 100;

        this.speed = 400;
        this.runSpeed = 750;
        this.isRunning = false;
        this.jumpForce = -700;

        // Double tap detection
        this.lastTapTime = 0;
        this.lastTapKey = '';

        this.isAttacking = false;
        this.attackTimer = 0;
        this.facing = 1; // 1 for right, -1 for left
        this.isBlocking = false;
    }

    update(deltaTime) {
        // Controls
        this.isBlocking = this.game.keys['ShiftLeft'] || this.game.keys['ShiftRight'];

        // Run detection (Double tap A or D)
        if (this.game.justPressed['KeyA'] || this.game.justPressed['KeyD']) {
            const now = Date.now();
            const key = this.game.keys['KeyA'] ? 'KeyA' : 'KeyD';
            if (now - this.lastTapTime < 250 && this.lastTapKey === key) {
                this.isRunning = true;
            }
            this.lastTapTime = now;
            this.lastTapKey = key;
        }

        if (!this.game.keys['KeyA'] && !this.game.keys['KeyD']) {
            this.isRunning = false;
        }

        const currentSpeed = this.isRunning ? this.runSpeed : this.speed;

        if (!this.isAttacking && !this.isBlocking) {
            if (this.game.keys['KeyA']) {
                this.vx = -currentSpeed;
                this.facing = -1;
                if (this.isRunning && Math.random() < 0.3) this.spawnRunParticles();
            } else if (this.game.keys['KeyD']) {
                this.vx = currentSpeed;
                this.facing = 1;
                if (this.isRunning && Math.random() < 0.3) this.spawnRunParticles();
            } else {
                this.vx = 0;
            }

            if (this.game.keys['Space'] && this.grounded) {
                this.vy = this.jumpForce;
            }

            // Attack inputs
            if (this.game.justPressed['KeyJ']) {
                this.attack('jab');
            } else if (this.game.justPressed['KeyK']) {
                this.attack('kick');
            } else if (this.game.justPressed['KeyL'] && this.game.playerLevel >= 2) {
                if (this.game.playerLevel >= 6) this.attack('gravity');
                else if (this.game.playerLevel >= 4) this.attack('sweep');
                else this.attack('uppercut');
            }
        } else {
            if (this.isBlocking) this.vx = 0;
            if (this.isAttacking) {
                this.vx = 0;
                this.attackTimer -= deltaTime;
                if (this.attackTimer <= 0) {
                    this.isAttacking = false;
                }
            }
        }

        super.update(deltaTime);
    }

    attack(type) {
        this.isAttacking = true;

        let dmg = 10 * (1 + (this.game.playerLevel - 1) * 0.05); // +5% dmg per level
        let range = 80;
        let yOffset = 20;
        let duration = 0.2;
        let knockback = 200;

        if (type === 'kick') { range = 100; dmg *= 1.2; duration = 0.3; knockback = 300; }
        // FIX: Uppercut hitbox was too high and didn't intersect correctly. Adjusting yOffset and height.
        if (type === 'uppercut') { range = 60; yOffset = -20; dmg *= 1.5; duration = 0.4; knockback = 50; }
        if (type === 'sweep') { range = 120; yOffset = 60; dmg *= 1.3; duration = 0.4; }
        if (type === 'gravity') { range = 200; dmg *= 2.5; duration = 0.6; knockback = 600; }

        this.attackTimer = duration;

        // Check collision with enemies (Increased hitbox height for reliability)
        const hitX = this.facing === 1 ? this.x + this.width : this.x - range;
        const hitBox = { x: hitX, y: this.y + yOffset, w: range, h: 60 };

        this.game.enemies.forEach(enemy => {
            if (this.rectIntersect(hitBox.x, hitBox.y, hitBox.w, hitBox.h, enemy.x, enemy.y, enemy.width, enemy.height)) {
                enemy.takeDamage(dmg);

                // Visual Feedback
                this.game.screenShake(5 + (dmg / 2), 0.1);
                this.game.spawnParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, '#00f2ff', 15);

                // Knockback
                enemy.vx = this.facing * knockback;
                if (type === 'uppercut') {
                    enemy.vy = -800;
                    enemy.vx = this.facing * 50;
                }
            }
        });
    }

    rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x2 < x1 + w1 && x2 + w2 > x1 && y2 < y1 + h1 && y2 + h2 > y1;
    }

    takeDamage(amount) {
        if (this.isBlocking) {
            amount *= 0.2; // 80% damage reduction
        }
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.game.gameOver();
        }
    }

    heal(amountPct) {
        const healAmt = this.maxHp * (amountPct / 100);
        this.hp = Math.min(this.maxHp, this.hp + healAmt);
    }

    spawnRunParticles() {
        this.game.spawnParticles(
            this.x + this.width / 2,
            600,
            'rgba(255, 255, 255, 0.3)',
            1
        );
    }

    draw(ctx) {
        // Draw Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2, 600, 40, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Sprite Rendering (with animation)
        ctx.save();

        // Dynamic animation based on state
        let scaleX = 1;
        let scaleY = 1;
        let rotation = 0;
        let yBump = 0;

        if (this.isAttacking) {
            scaleX = 1.2;
            scaleY = 0.9;
        } else if (!this.grounded) {
            scaleY = 1.1;
            scaleX = 0.9;
        } else if (Math.abs(this.vx) > 0) {
            yBump = Math.sin(Date.now() * 0.015) * 5;
            rotation = (this.vx / this.speed) * 0.1; // Increased lean for running
            if (this.isRunning) {
                scaleX = 1.1;
                scaleY = 0.95;
                rotation = (this.vx / this.runSpeed) * 0.25; // Sharp lean while sprinting
            }
        }

        if (this.facing === -1) {
            ctx.scale(-1, 1);
            ctx.translate(-(this.x + this.width / 2), this.y + this.height / 2);
            ctx.rotate(-rotation);
            ctx.drawImage(this.game.assets.player, -50 * scaleX, (-70 * scaleY) + yBump, 100 * scaleX, 140 * scaleY);
        } else {
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.rotate(rotation);
            ctx.drawImage(this.game.assets.player, -50 * scaleX, (-70 * scaleY) + yBump, 100 * scaleX, 140 * scaleY);
        }
        ctx.restore();

        // Blocking/Attacking Overlays
        if (this.isBlocking) {
            ctx.strokeStyle = '#00f2ff';
            ctx.lineWidth = 3;
            ctx.strokeRect(this.x - 5, this.y - 5, this.width + 10, this.height + 10);
        }

        if (this.isAttacking) {
            ctx.fillStyle = 'rgba(0, 242, 255, 0.3)';
            const range = 80;
            if (this.facing === 1) {
                ctx.fillRect(this.x + this.width, this.y + 20, range, 20);
            } else {
                ctx.fillRect(this.x - range, this.y + 20, range, 20);
            }
        }
    }
}

class Enemy extends Entity {
    constructor(game) {
        super(game);
        this.x = 1000;
        this.y = 500;
        this.color = '#ff3e3e';

        const scale = this.game.enemyScalingFactor;
        this.maxHp = 50 * scale;
        this.hp = this.maxHp;
        this.damage = 5 * scale;
        this.speed = 150 + (scale * 20);

        this.attackCooldown = 1.0;
        this.attackTimer = 0;
        this.flashTimer = 0;
    }

    update(deltaTime) {
        const dist = this.game.player.x - this.x;
        const dir = Math.sign(dist);

        if (Math.abs(dist) > 70) {
            this.vx = dir * this.speed;
        } else {
            this.vx = 0;
            // Attack
            this.attackTimer -= deltaTime;
            if (this.attackTimer <= 0) {
                this.attack();
            }
        }

        if (this.flashTimer > 0) this.flashTimer -= deltaTime;

        // Ranged Attack Logic
        if (Math.abs(dist) > 300 && this.attackTimer <= 0) {
            this.throwProjectile();
        }

        super.update(deltaTime);
    }

    throwProjectile() {
        this.attackTimer = this.attackCooldown * 2; // longer cooldown for range
        const dir = Math.sign(this.game.player.x - this.x);
        const proj = new Projectile(this.game, this.x + this.width / 2, this.y + 20, dir);
        this.game.entities.push(proj);
        this.game.projectiles.push(proj);
    }

    draw(ctx) {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2, 600, 50, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // Sprite with animation
        const distToPlayer = this.game.player.x - this.x;
        const enemyFacing = Math.sign(distToPlayer);

        ctx.save();

        let scaleX = 1;
        let scaleY = 1;
        let yBump = Math.sin(Date.now() * 0.005) * 5; // Breathing idle
        let rot = 0;

        if (Math.abs(this.vx) > 0) {
            yBump += Math.sin(Date.now() * 0.015) * 8; // Walking bob
            rot = (this.vx / this.speed) * 0.1;
        }

        // Hit flash squash
        if (this.flashTimer > 0) {
            scaleX = 1.3;
            scaleY = 0.7;
        }

        if (enemyFacing === -1) {
            ctx.scale(-1, 1);
            ctx.translate(-(this.x + this.width / 2), this.y + this.height / 2);
            ctx.rotate(-rot);
            ctx.drawImage(this.game.assets.enemy, -60 * scaleX, (-80 * scaleY) + yBump, 120 * scaleX, 160 * scaleY);
        } else {
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.rotate(rot);
            ctx.drawImage(this.game.assets.enemy, -60 * scaleX, (-80 * scaleY) + yBump, 120 * scaleX, 160 * scaleY);
        }
        ctx.restore();

        // Hit flash overlay
        if (this.flashTimer > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    attack() {
        this.game.player.takeDamage(this.damage);
        this.attackTimer = this.attackCooldown;
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.flashTimer = 0.1;

        if (this.hp <= 0) {
            this.toRemove = true;
            this.game.onEnemyKilled();
        }
    }
}

class Drop extends Entity {
    constructor(game, x, y) {
        super(game);
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.color = '#44ff44';
        this.bob = 0;
    }

    update(deltaTime) {
        super.update(deltaTime);
        this.bob += deltaTime * 5;

        // Pick up
        const p = this.game.player;
        if (this.rectIntersect(this.x, this.y, this.width, this.height, p.x, p.y, p.width, p.height)) {
            p.heal(15);
            this.toRemove = true;
        }
    }

    rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x2 < x1 + w1 && x2 + w2 > x1 && y2 < y1 + h1 && y2 + h2 > y1;
    }

    draw(ctx) {
        const offset = Math.sin(this.bob) * 5;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x + 10, this.y + 10 + offset, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

/**
 * Particle system for visual effects
 */
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 600;
        this.vy = (Math.random() - 0.5) * 600;
        this.life = 1.0;
        this.color = color;
        this.size = Math.random() * 5 + 2;
    }

    update(deltaTime) {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        this.vy += 800 * deltaTime; // gravity
        this.life -= deltaTime * 2;
    }

    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}

/**
 * Enemy Projectile
 */
class Projectile extends Entity {
    constructor(game, x, y, dir) {
        super(game);
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 10;
        this.vx = dir * 600;
        this.vy = 0;
        this.damage = 10 * game.enemyScalingFactor;
        this.color = '#ff3e3e';
        this.grounded = true; // No gravity for projectiles usually
    }

    update(deltaTime) {
        this.x += this.vx * deltaTime;

        // Check collision with player
        const p = this.game.player;
        if (this.rectIntersect(this.x, this.y, this.width, this.height, p.x, p.y, p.width, p.height)) {
            p.takeDamage(this.damage);
            this.game.spawnParticles(this.x, this.y, this.color, 8);
            this.game.screenShake(5, 0.1);
            this.toRemove = true;
        }

        // Remove if off screen
        if (this.x < 0 || this.x > 1280) this.toRemove = true;
    }

    rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x2 < x1 + w1 && x2 + w2 > x1 && y2 < y1 + h1 && y2 + h2 > y1;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;

        // Draw a glowing "streak" or fireball
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.shadowBlur = 0;
    }
}

// Start game
new Game();
