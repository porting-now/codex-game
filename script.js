const panels = Array.from(document.querySelectorAll(".panel"));
const startButton = document.getElementById("startGame");
const characterGrid = document.getElementById("characterGrid");
const heroName = document.getElementById("heroName");
const hudObjective = document.getElementById("hudObjective");
const hudWeapon = document.getElementById("hudWeapon");
const hudHealth = document.getElementById("hudHealth");
const statusText = document.getElementById("statusText");
const hintText = document.getElementById("gameHint");
const toggleHints = document.getElementById("toggleHints");
const toggleMusic = document.getElementById("toggleMusic");
const restartButton = document.getElementById("restart");

let selectedHero = null;
let hintsOn = true;
let musicOn = false;

const map = [
  "#############################",
  "#...............E...........#",
  "#...........====............#",
  "#............R....E.........#",
  "#.......====...........D....#",
  "#...........................#",
  "#.....E.............====....#",
  "#............====...........#",
  "#..S.....................E..#",
  "#############################",
];

const tileSize = 24;
const gravity = 0.6;
const jumpPower = -10.5;
const maxSpeed = 3.6;
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const keys = new Set();

let player;
let enemies;
let bullets;
let relicCollected = false;
let doorUnlocked = false;
let gamePaused = false;

const assets = {
  player: "🧍",
  enemy: "💀",
  relic: "🔮",
  door: "🚪",
  bullet: "✦",
  platform: "▓",
  wall: "█",
};

const heroTraits = {
  Wraith: { speed: 3.8, ammo: 7, health: 3 },
  "Rune Knight": { speed: 3.4, ammo: 6, health: 4 },
  Ironbound: { speed: 3.0, ammo: 5, health: 5 },
};

const storyByState = {
  start: "The prison stirs. Find the relic to regain the first shard.",
  relic: "Power shard reclaimed. The warden stirs beyond the door.",
  boss: "Boss gate open. Defeat the devil's champion to escape.",
};

const switchPanel = (name) => {
  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === name);
  });
};

const updateStory = (state) => {
  const storyText = document.getElementById("storyText");
  storyText.textContent = storyByState[state];
  if (state === "relic") {
    hudObjective.textContent = "Unlock the boss door";
    hintText.textContent = "The 🚪 door glows. Defeat the warden beyond.";
  }
  if (state === "boss") {
    hudObjective.textContent = "Defeat the warden";
    hintText.textContent = "Shoot the 💀 warden 3 times to escape.";
  }
};

const resetGameState = () => {
  const spawn = findTile("S");
  const trait = heroTraits[selectedHero] || heroTraits["Rune Knight"];
  player = {
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    width: tileSize,
    height: tileSize,
    onGround: false,
    ammo: trait.ammo,
    health: trait.health,
    speed: trait.speed,
  };
  enemies = findTiles("E").map((tile, index) => ({
    id: index,
    x: tile.x,
    y: tile.y,
    alive: true,
    health: index === 1 ? 3 : 1,
    isBoss: index === 1,
  }));
  bullets = [];
  relicCollected = false;
  doorUnlocked = false;
  gamePaused = false;
  updateStory("start");
  updateHud();
};

const updateHud = () => {
  hudHealth.textContent = "❤".repeat(player.health);
  hudWeapon.textContent = `Blaster: ${player.ammo}`;
  heroName.textContent = selectedHero || "-";
  statusText.innerHTML = `Selected hero: <span id="heroName">${selectedHero || "-"}</span>`;
};

const findTile = (symbol) => {
  for (let row = 0; row < map.length; row += 1) {
    for (let col = 0; col < map[row].length; col += 1) {
      if (map[row][col] === symbol) {
        return { x: col * tileSize, y: row * tileSize };
      }
    }
  }
  return { x: tileSize, y: tileSize };
};

const findTiles = (symbol) => {
  const tiles = [];
  for (let row = 0; row < map.length; row += 1) {
    for (let col = 0; col < map[row].length; col += 1) {
      if (map[row][col] === symbol) {
        tiles.push({ x: col * tileSize, y: row * tileSize });
      }
    }
  }
  return tiles;
};

const isSolid = (row, col) => {
  const tile = map[row]?.[col];
  return tile === "#" || tile === "=";
};

const drawTile = (symbol, x, y) => {
  ctx.font = "20px ui-monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f8f4ff";
  ctx.fillText(symbol, x + tileSize / 2, y + tileSize / 2);
};

const handleInput = () => {
  if (keys.has("ArrowLeft") || keys.has("KeyA")) {
    player.vx = -player.speed;
  } else if (keys.has("ArrowRight") || keys.has("KeyD")) {
    player.vx = player.speed;
  } else {
    player.vx *= 0.7;
  }

  if ((keys.has("ArrowUp") || keys.has("KeyW") || keys.has("Space")) && player.onGround) {
    player.vy = jumpPower;
    player.onGround = false;
  }
};

const shoot = () => {
  if (player.ammo <= 0 || gamePaused) return;
  const direction = keys.has("ArrowLeft") || keys.has("KeyA") ? -1 : 1;
  bullets.push({
    x: player.x + player.width / 2,
    y: player.y + player.height / 2,
    vx: direction * 6,
  });
  player.ammo -= 1;
  updateHud();
};

const resolveCollisions = () => {
  player.onGround = false;

  const nextX = player.x + player.vx;
  if (!collides(nextX, player.y)) {
    player.x = nextX;
  } else {
    player.vx = 0;
  }

  player.vy += gravity;
  if (player.vy > 12) player.vy = 12;

  const nextY = player.y + player.vy;
  if (!collides(player.x, nextY)) {
    player.y = nextY;
  } else if (player.vy > 0) {
    player.onGround = true;
    player.vy = 0;
    player.y = Math.floor(player.y / tileSize) * tileSize;
  } else {
    player.vy = 0;
  }
};

const collides = (x, y) => {
  const left = Math.floor(x / tileSize);
  const right = Math.floor((x + player.width - 1) / tileSize);
  const top = Math.floor(y / tileSize);
  const bottom = Math.floor((y + player.height - 1) / tileSize);

  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      if (isSolid(row, col)) {
        return true;
      }
    }
  }
  return false;
};

const updateEnemies = () => {
  enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    if (Math.abs(player.x - enemy.x) < 10 && Math.abs(player.y - enemy.y) < 10) {
      player.health = Math.max(1, player.health - 1);
      player.x -= 20;
      updateHud();
    }
  });
};

const updateBullets = () => {
  bullets = bullets.filter((bullet) => {
    bullet.x += bullet.vx;
    if (bullet.x < 0 || bullet.x > canvas.width) return false;
    const hit = enemies.find(
      (enemy) =>
        enemy.alive &&
        Math.abs(enemy.x - bullet.x) < tileSize / 2 &&
        Math.abs(enemy.y - bullet.y) < tileSize / 2,
    );
    if (hit) {
      hit.health -= 1;
      if (hit.health <= 0) {
        hit.alive = false;
        if (hit.isBoss) {
          hintText.textContent = "Boss defeated! The gate unlocks. Escape is yours.";
          hudObjective.textContent = "Escape complete";
        }
      }
      return false;
    }
    return true;
  });
};

const updateRelic = () => {
  if (relicCollected) return;
  const relic = findTile("R");
  if (Math.abs(player.x - relic.x) < tileSize && Math.abs(player.y - relic.y) < tileSize) {
    relicCollected = true;
    doorUnlocked = true;
    updateStory("relic");
    player.ammo += 4;
    updateHud();
  }
};

const updateDoor = () => {
  if (!doorUnlocked) return;
  const door = findTile("D");
  if (Math.abs(player.x - door.x) < tileSize && Math.abs(player.y - door.y) < tileSize) {
    updateStory("boss");
  }
};

const drawMap = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < map.length; row += 1) {
    for (let col = 0; col < map[row].length; col += 1) {
      const tile = map[row][col];
      const x = col * tileSize;
      const y = row * tileSize;
      if (tile === "#") {
        drawTile(assets.wall, x, y);
      }
      if (tile === "=") {
        drawTile(assets.platform, x, y);
      }
      if (tile === "R" && !relicCollected) {
        drawTile(assets.relic, x, y);
      }
      if (tile === "D") {
        drawTile(assets.door, x, y);
      }
    }
  }

  enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    drawTile(enemy.isBoss ? "👹" : assets.enemy, enemy.x, enemy.y);
  });

  bullets.forEach((bullet) => {
    drawTile(assets.bullet, bullet.x - tileSize / 2, bullet.y - tileSize / 2);
  });

  drawTile(assets.player, player.x, player.y);
};

const gameLoop = () => {
  if (!gamePaused) {
    handleInput();
    resolveCollisions();
    updateEnemies();
    updateBullets();
    updateRelic();
    updateDoor();
  }
  drawMap();
  requestAnimationFrame(gameLoop);
};

const handlePanelButtons = () => {
  document.querySelectorAll("[data-next]").forEach((button) => {
    button.addEventListener("click", () => switchPanel(button.dataset.next));
  });
  document.querySelectorAll("[data-prev]").forEach((button) => {
    button.addEventListener("click", () => switchPanel(button.dataset.prev));
  });
};

const setupCharacters = () => {
  characterGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".character-card");
    if (!card) return;
    selectedHero = card.dataset.character;
    document.querySelectorAll(".character-card").forEach((item) => {
      item.classList.toggle("active", item === card);
    });
    startButton.disabled = false;
  });
};

const setupControls = () => {
  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (event.code === "KeyJ") {
      shoot();
    }
    if (event.code === "KeyP") {
      gamePaused = !gamePaused;
      hintText.textContent = gamePaused
        ? "Paused. Press P to resume."
        : "Collect the 🔮 relic to unlock the boss door.";
    }
    keys.add(event.code);
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
  });
};

startButton.addEventListener("click", () => {
  switchPanel("game");
  resetGameState();
});

restartButton.addEventListener("click", resetGameState);

toggleHints.addEventListener("click", () => {
  hintsOn = !hintsOn;
  hintText.style.opacity = hintsOn ? "1" : "0";
  toggleHints.textContent = hintsOn ? "Hints" : "Hints Off";
});

toggleMusic.addEventListener("click", () => {
  musicOn = !musicOn;
  toggleMusic.textContent = musicOn ? "Echoes On" : "Toggle Echoes";
});

handlePanelButtons();
setupCharacters();
setupControls();

lucide.createIcons();

switchPanel("splash");
resetGameState();

requestAnimationFrame(gameLoop);
