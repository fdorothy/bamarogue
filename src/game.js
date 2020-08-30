import { Map, Display, Engine, KEYS, RNG, FOV, Color } from 'rot-js/lib/index';
import { Player } from './player'
import { Util } from './util'
import { Dialogue } from './story'
let inkStoryJson = require('../story.ink.json');
import { Messages } from './messages'
import { Status } from './status'
import { Monster } from './monster'
import { Item } from './item'

export class Game {
  constructor() {
    this.engine = null;
    this.player = null;
    this.width = 100
    this.height = 40
    this.display = new Display({width: this.width, height: this.height});
    document.body.appendChild(this.display.getContainer());
    this.statusWidth = 15
    this.messageHeight = 4
    this.mapWidth = this.width - this.statusWidth - 1
    this.mapHeight = this.height - this.messageHeight - 1
    this.dialogue = new Dialogue(inkStoryJson, this);
    this.messages = new Messages(this, this.statusWidth+2, this.messageHeight-1);
    this.status = new Status(this, this.statusWidth)

    this.restart()
    this.mainLoop()
  }

  restart() {
    this.player = new Player(0, 0, this)
    this.monsters = []
    this.items = []
    this.level = 1
    this.dialogue.play("title")
  }

  onExit() {
    this.level++
    this.startLevel()
  }

  newGame() {
    this.startLevel()
  }

  startLevel() {
    this.generateMap();
    this.dialogue.play(`level${this.level}`, () => {
      this.messages.push("Use the arrow keys to move")
    })
  }

  handleStoryEvent(event) {
    const name = event[0]
    switch (name) {
    case ':newgame':
      this.newGame()
      break;
    case ':restart':
      this.restart()
    default: break;
    }
  }

  async mainLoop() {
    while (1) {
      if (this.dialogue.showing) {
        console.log('dialogue turn')
        await this.dialogue.act()
      } else {
        console.log('start of turn')
        this.draw()
        const result = await this.player.act()
        if (result) {
          this.checkItems()
          this.removeDeadMonsters()
          for (let i=0; i<this.monsters.length; i++) {
            await this.monsters[i].act()
          }
          this.checkGameOver()
        }
        this.draw()
      }
    }
  }

  removeDeadMonsters() {
    this.monsters = this.monsters.filter(m => !m.dead)
  }

  checkItems() {
    const item = this.getItem(this.player.x, this.player.y)
    if (item) {
      item.pickup(this.player)
      this.items = this.items.filter(m => !m.pickedUp)
    }
  }

  checkGameOver() {
    if (this.player.dead) {
      this.dialogue.play("gameover")
    }
  }

  canMonsterMove(x, y) {
    if (this.getMonster(x, y))
      return false
    return ((x+","+y in this.map))
  }

  canPlayerMove(x, y) {
    if (this.getMonster(x, y))
      return false
    return ((x+","+y in this.map))
  }

  getMonster(x, y) {
    for (let i=0; i<this.monsters.length; i++) {
      let m = this.monsters[i];
      if (m.x == x && m.y == y)
        return m;
    }
    return null;
  }

  getItem(x, y) {
    for (let i=0; i<this.items.length; i++) {
      let m = this.items[i];
      if (m.x == x && m.y == y)
        return m;
    }
    return null;
  }

  generateMap() {
    this.map = {};
    this.knownMap = {};
    this.items = []
    let digger = new Map.Digger(this.mapWidth, this.mapHeight);
    let freeCells = [];

    let digCallback = function(x, y, value) {
      if (value) {return;} /* do not store walls */

      let key = Util.key(x, y);
      freeCells.push(key);
      this.map[key] = ".";
      this.knownMap[key] = 1;
    }

    digger.create(digCallback.bind(this));

    this.setPlayerPositionRandom(freeCells);
    this.generateMonsters(freeCells);
    this.placeExit(freeCells)
  }

  setPlayerPositionRandom(freeCells) {
    let index = Math.floor(RNG.getUniform() * freeCells.length);
    let key = freeCells.splice(index, 1)[0];
    let [x, y] = Util.parseKey(key)
    this.player.x = x
    this.player.y = y
  }

  placeExit(freeCells) {
    const [x, y] = this.randomFreeCell(freeCells)
    const exit = new Item(x, y, this)
    exit.name = 'exit'
    exit.token = '~'
    exit.color = 'blue'
    exit.onPickup = (player) => {
      this.onExit()
    }
    this.items.push(exit)
  }

  randomFreeCell(freeCells) {
    const index = Math.floor(RNG.getUniform() * freeCells.length);
    const key = freeCells.splice(index, 1)[0];
    const [x, y] = Util.parseKey(key)
    return [x, y]
  }

  drawWholeMap() {
    for (let key in this.map) {
      const [x, y] = this.worldToScreen(Util.parseKey(key))
      this.display.draw(x, y, this.map[key]);
    }
  }

  drawMapFieldOfView() {
    const game = this
    let fov = new FOV.PreciseShadowcasting((x, y) => {
      var key = x+","+y;
      if (key in game.map) { return (game.map[key]); }
      return false;
    });

    /* output callback */
    this.fov = {}
    fov.compute(this.player.x, this.player.y, 10, function(x, y, r, visibility) {
      const key = Util.key(x,y)
      game.fov[key] = r
      game.knownMap[key] = 1
    });
  }

  drawCompositeMap() {
    for (let key in this.knownMap) {
      const [x, y] = this.worldToScreen(Util.parseKey(key))
      let color = Color.toHex(Util.minGray)
      if (key in this.fov) {
        const light = this.fov[key]
        color = Util.grayscale(1.0 - this.fov[key] / 10.0)
      }
      this.display.draw(x, y, this.map[key], color)
    }
  }

  draw() {
    this.display.clear()
    this.drawMapFieldOfView()
    this.drawCompositeMap()
    this.player.draw()
    this.monsters.forEach((m) => m.draw(this.knownMap))
    this.items.forEach((m) => m.draw(this.knownMap))
    if (this.dialogue)
      this.dialogue.draw()
    if (this.messages)
      this.messages.draw()
    if (this.status)
      this.status.draw()
    this.drawLine(this.statusWidth, 0, this.statusWidth, this.height, '|', '|')
    this.drawLine(this.statusWidth, this.messageHeight, this.width, this.messageHeight, '-', '+')
  }

  worldToScreen([x, y]) {
    return [x + this.statusWidth + 1, y + this.messageHeight + 1]
  }

  generateMonsters(freeCells) {
    this.monsters = []
    for (let i=0; i<10; i++) {
      let index = Math.floor(RNG.getUniform() * freeCells.length);
      let key = freeCells.splice(index, 1)[0];
      const [x, y] = Util.parseKey(key)
      this.monsters.push(new Monster(x, y, this))
    }
  }

  drawBox(rect, v) {
    for (let x=rect[0]; x<=rect[2]; x++) {
      for (let y=rect[1]; y<=rect[3]; y++) {
        this.display.draw(x, y, v)
      }
    }
  }

  drawBorder(rect, vx, vy, vc) {
    let x = 0, y = 0;
    for (x=rect[0]; x<=rect[2]; x++) {
      this.display.draw(x, rect[1], vx)
    }
    for (x=rect[0]; x<=rect[2]; x++) {
      this.display.draw(x, rect[3], vx)
    }
    for (y=rect[1]; y<=rect[3]; y++) {
      this.display.draw(rect[0], y, vy)
    }
    for (y=rect[1]; y<=rect[3]; y++) {
      this.display.draw(rect[2], y, vy)
    }
    this.display.draw(rect[0], rect[1], vc)
    this.display.draw(rect[0], rect[3], vc)
    this.display.draw(rect[2], rect[1], vc)
    this.display.draw(rect[2], rect[3], vc)
  }

  drawLine(x0, y0, x1, y1, v, vc) {
    let x = x0, y = y0;
    let dx = x0 > x1 ? -1 : 1;
    let dy = y0 > y1 ? -1 : 1;
    while (x != x1 || y != y1) {
      if (x != x1)
        x += dx;
      if (y != y1)
        y += dy;
      this.display.draw(x, y, v)
    }
    this.display.draw(x0, y0, vc)
    this.display.draw(x1, y1, vc)
  }
}
