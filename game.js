(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width;
  const H = canvas.height;
  const FLOOR = 606;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  const hexToRgb = hex => {
    const v = hex.replace('#', '');
    const n = parseInt(v.length === 3 ? v.split('').map(c => c + c).join('') : v, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const rgba = (hex, a = 1) => {
    const c = hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${a})`;
  };

  const { FIGHTERS, STAGES } = window.RIFTBOUND_DATA;

  class Input {
    constructor() {
      this.held = new Set();
      this.press = new Set();
      addEventListener('keydown', e => {
        if (!this.held.has(e.code)) this.press.add(e.code);
        this.held.add(e.code);
        if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
        audio.unlock();
      }, {passive:false});
      addEventListener('keyup', e => this.held.delete(e.code));
      addEventListener('blur', () => { this.held.clear(); this.press.clear(); });
      document.querySelectorAll('[data-key]').forEach(btn => {
        const code = btn.dataset.key;
        const down = e => { e.preventDefault(); if (!this.held.has(code)) this.press.add(code); this.held.add(code); audio.unlock(); };
        const up = e => { e.preventDefault(); this.held.delete(code); };
        btn.addEventListener('pointerdown', down);
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointercancel', up);
        btn.addEventListener('pointerleave', up);
      });
    }
    is(code) { return this.held.has(code); }
    tap(code) { return this.press.has(code); }
    endFrame() { this.press.clear(); }
  }

  class AudioEngine {
    constructor() { this.ctx = null; this.enabled = true; }
    unlock() {
      if (!this.enabled) return;
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }
    tone(freq=180, dur=.06, type='square', gain=.035, slide=0) {
      if (!this.ctx || !this.enabled) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.linearRampToValueAtTime(Math.max(30, freq+slide), t+dur);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t+dur);
      o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t+dur);
    }
    hit(strength=1) { this.tone(110 + strength*25, .055 + strength*.018, 'square', .04, -70); }
    swing(strength=1) { this.tone(280 + strength*60, .045, 'sawtooth', .022, -130); }
    menu() { this.tone(520, .045, 'square', .022, 70); }
    select() { this.tone(300, .08, 'square', .03, 420); }
    special() { this.tone(180, .13, 'sawtooth', .035, 420); }
    ultimate() { this.tone(90, .32, 'sawtooth', .05, 740); }
  }

  const input = new Input();
  const audio = new AudioEngine();

  const controls = {
    p1:{left:'KeyA', right:'KeyD', up:'KeyW', down:'KeyS', light:'KeyJ', heavy:'KeyK', special:'KeyL', ultimate:'KeyI'},
    p2:{left:'ArrowLeft', right:'ArrowRight', up:'ArrowUp', down:'ArrowDown', light:'Numpad1', heavy:'Numpad2', special:'Numpad3', ultimate:'Numpad0', light2:'KeyN', heavy2:'KeyM', special2:'Comma', ultimate2:'Period'}
  };

  let gameState = 'title';
  let modeIndex = 0;
  const modes = ['ARCADE', 'VERSUS LOCAL', 'TREINO'];
  let selectIndex = 0;
  let p1Index = 0;
  let p2Index = 1;
  let selectingPlayer = 1;
  let mode = 'ARCADE';
  let stage = STAGES[0];
  let fighters = [];
  let projectiles = [];
  let particles = [];
  let afterImages = [];
  let floatTexts = [];
  let roundWins = [0,0];
  let round = 1;
  let timer = 99 * 60;
  let introTimer = 150;
  let roundOverTimer = 0;
  let globalHitstop = 0;
  let shake = 0;
  let flash = 0;
  let paused = false;
  let frame = 0;

  function resetTransient() {
    projectiles = []; particles = []; afterImages = []; floatTexts = [];
    globalHitstop = 0; shake = 0; flash = 0;
  }

  class Particle {
    constructor(x,y,color,opts={}) {
      this.x=x; this.y=y; this.vx=opts.vx ?? rand(-5,5); this.vy=opts.vy ?? rand(-5,1);
      this.life=opts.life ?? 26; this.max=this.life; this.size=opts.size ?? rand(3,8); this.color=color;
      this.gravity=opts.gravity ?? .22; this.shape=opts.shape ?? 'square';
    }
    update(){ this.x+=this.vx; this.y+=this.vy; this.vy+=this.gravity; this.vx*=.97; this.life--; }
    draw(){
      const a=clamp(this.life/this.max,0,1); ctx.globalAlpha=a;
      ctx.fillStyle=this.color;
      if(this.shape==='line'){ ctx.fillRect(this.x-this.size*2,this.y,this.size*4,2); }
      else ctx.fillRect(Math.round(this.x),Math.round(this.y),this.size,this.size);
      ctx.globalAlpha=1;
    }
  }

  class Projectile {
    constructor(owner, x, y, vx, color, damage, type='energy', opts={}) {
      this.owner=owner; this.x=x; this.y=y; this.vx=vx; this.vy=opts.vy || 0; this.color=color; this.damage=damage;
      this.type=type; this.life=opts.life || 120; this.w=opts.w || 46; this.h=opts.h || 24; this.pierce=opts.pierce || false;
      this.knock=opts.knock || 8; this.hit=false; this.delay=opts.delay || 0;
    }
    update(){
      if(this.delay>0){this.delay--; return;}
      this.x += this.vx; this.y += this.vy; this.life--;
      if (frame%3===0) particles.push(new Particle(this.x, this.y, this.color, {vx:rand(-1,1),vy:rand(-1,1),life:12,size:4,gravity:0}));
      const target = fighters.find(f=>f!==this.owner);
      if(target && !this.hit && rectsOverlap(this.box(), target.hurtbox())){
        target.receiveHit(this.owner, this.damage, this.owner.facing*this.knock, -2.5, {projectile:true, color:this.color});
        this.hit=true; if(!this.pierce)this.life=0;
      }
    }
    box(){return {x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h};}
    draw(){
      if(this.delay>0)return;
      ctx.save(); ctx.translate(this.x,this.y);
      ctx.shadowBlur=18; ctx.shadowColor=this.color; ctx.fillStyle=this.color;
      if(this.type==='bullet'){ ctx.fillRect(-18,-3,36,6); ctx.fillStyle='#fff';ctx.fillRect(5,-2,12,4); }
      else if(this.type==='seal'){ ctx.rotate(frame*.05); ctx.strokeStyle=this.color; ctx.lineWidth=4; ctx.strokeRect(-18,-18,36,36); ctx.fillStyle=rgba(this.color,.25);ctx.fillRect(-13,-13,26,26); }
      else if(this.type==='drone'){ ctx.fillRect(-18,-10,36,20); ctx.fillStyle='#f4b84c';ctx.fillRect(-4,-15,8,30); }
      else { ctx.beginPath(); ctx.ellipse(0,0,this.w/2,this.h/2,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#fff';ctx.globalAlpha=.7;ctx.beginPath();ctx.ellipse(7,-3,this.w*.18,this.h*.18,0,0,Math.PI*2);ctx.fill(); }
      ctx.restore(); ctx.globalAlpha=1; ctx.shadowBlur=0;
    }
  }

  class Fighter {
    constructor(data, player, x, facing, cpu=false) {
      this.data=data; this.player=player; this.x=x; this.y=FLOOR; this.vx=0; this.vy=0; this.facing=facing; this.cpu=cpu;
      this.maxHp=data.hp; this.hp=data.hp; this.meter=0; this.onGround=true; this.stun=0; this.blockstun=0; this.attack=null; this.attackFrame=0;
      this.cooldown=0; this.invuln=0; this.armor=0; this.combo=0; this.comboTimer=0; this.lastHitBy=null; this.aiWait=0;
      this.width=64; this.height=124; this.blocking=false; this.dead=false; this.afterTimer=0;
    }
    hurtbox(){ return {x:this.x-this.width/2, y:this.y-this.height, w:this.width, h:this.height}; }
    inputMap(){return this.player===1?controls.p1:controls.p2;}
    pressed(action){
      const m=this.inputMap();
      if(action==='light' && this.player===2) return input.tap(m.light)||input.tap(m.light2);
      if(action==='heavy' && this.player===2) return input.tap(m.heavy)||input.tap(m.heavy2);
      if(action==='special' && this.player===2) return input.tap(m.special)||input.tap(m.special2);
      if(action==='ultimate' && this.player===2) return input.tap(m.ultimate)||input.tap(m.ultimate2);
      return input.tap(m[action]);
    }
    held(action){ return input.is(this.inputMap()[action]); }
    update(target){
      if(this.dead)return;
      if(this.invuln>0)this.invuln--;
      if(this.cooldown>0)this.cooldown--;
      if(this.comboTimer>0)this.comboTimer--; else this.combo=0;
      this.blocking=false;
      if(this.cpu) this.updateAI(target);

      if(this.stun>0){ this.stun--; }
      else if(this.blockstun>0){ this.blockstun--; }
      else if(this.attack){ this.updateAttack(target); }
      else {
        const c=this.cpu?this.aiControls: null;
        const left=this.cpu?c.left:this.held('left');
        const right=this.cpu?c.right:this.held('right');
        const jump=this.cpu?c.jump:this.pressed('up');
        const block=this.cpu?c.block:this.held('down');
        const light=this.cpu?c.light:this.pressed('light');
        const heavy=this.cpu?c.heavy:this.pressed('heavy');
        const special=this.cpu?c.special:this.pressed('special');
        const ultimate=this.cpu?c.ultimate:this.pressed('ultimate');

        if(block && this.onGround){ this.blocking=true; this.vx*=.72; }
        else {
          const accel=this.onGround?.82:.48;
          if(left)this.vx=lerp(this.vx,-this.data.speed,accel);
          else if(right)this.vx=lerp(this.vx,this.data.speed,accel);
          else this.vx*=this.onGround?.72:.97;
        }
        if(jump && this.onGround){this.vy=-this.data.jump;this.onGround=false; audio.tone(210,.045,'square',.016,80);}
        if(ultimate && this.meter>=100) this.startAttack('ultimate');
        else if(special && this.cooldown<=0) this.startAttack('special');
        else if(heavy) this.startAttack('heavy');
        else if(light) this.startAttack('light');
      }

      this.vy += this.onGround ? 0 : .72;
      this.x += this.vx; this.y += this.vy;
      if(this.y>=FLOOR){this.y=FLOOR;this.vy=0;this.onGround=true;}
      this.x=clamp(this.x,58,W-58);
      if(!this.attack && this.stun<=0 && target) this.facing = target.x >= this.x ? 1 : -1;
      if(Math.abs(this.vx)>6.4 && frame%4===0) this.makeAfterImage(.18);
    }
    updateAI(target){
      if(!this.aiControls)this.aiControls={left:false,right:false,jump:false,block:false,light:false,heavy:false,special:false,ultimate:false};
      Object.keys(this.aiControls).forEach(k=>this.aiControls[k]=false);
      if(introTimer>0||roundOverTimer>0)return;
      if(this.aiWait>0){this.aiWait--;return;}
      const d=target.x-this.x, ad=Math.abs(d);
      const difficulty=mode==='TREINO'?0:.72;
      if(mode==='TREINO') return;
      if(target.attack && Math.random()<.05+difficulty*.045 && ad<160){this.aiControls.block=true;this.aiWait=6;return;}
      if(ad>190){ if(d<0)this.aiControls.left=true;else this.aiControls.right=true; }
      else if(ad<70 && Math.random()<.12){ if(d<0)this.aiControls.right=true;else this.aiControls.left=true; }
      if(this.meter>=100 && Math.random()<.012 && ad<260){this.aiControls.ultimate=true;this.aiWait=18;return;}
      if(this.cooldown<=0 && Math.random()<.018 && ad<430){this.aiControls.special=true;this.aiWait=14;return;}
      if(ad<115){
        if(Math.random()<.045){this.aiControls.heavy=true;this.aiWait=16;}
        else if(Math.random()<.11){this.aiControls.light=true;this.aiWait=8;}
      }
      if(ad>200 && Math.random()<.004){this.aiControls.jump=true;}
    }
    startAttack(type){
      if(this.attack||this.stun>0||this.blockstun>0)return;
      this.attack=type;this.attackFrame=0;
      if(type==='light'){audio.swing(.7);}
      if(type==='heavy'){audio.swing(1.2);}
      if(type==='special'){audio.special();this.cooldown=42;}
      if(type==='ultimate'){audio.ultimate();this.meter=0;flash=14;shake=18;this.invuln=22;}
    }
    attackDef(type){
      const p=this.data.power;
      if(type==='light') return {startup:4,active:5,recovery:9,damage:55*p,range:76*this.data.reach,h:58,y:-82,knock:4.7,vy:-1.4,hitstop:5};
      if(type==='heavy') return {startup:10,active:6,recovery:15,damage:105*p,range:103*this.data.reach,h:72,y:-88,knock:9.4,vy:-4.3,hitstop:8};
      return null;
    }
    updateAttack(target){
      this.attackFrame++;
      if(this.attack==='light'||this.attack==='heavy'){
        const d=this.attackDef(this.attack), total=d.startup+d.active+d.recovery;
        if(this.attackFrame===d.startup){this.attackHasHit=false;}
        if(this.attackFrame>=d.startup && this.attackFrame<d.startup+d.active && !this.attackHasHit){
          const box=this.attackBox(d.range,d.h,d.y);
          if(rectsOverlap(box,target.hurtbox())){ target.receiveHit(this,d.damage,this.facing*d.knock,d.vy,{color:this.data.color,hitstop:d.hitstop,heavy:this.attack==='heavy'});this.attackHasHit=true; }
        }
        if(this.attack==='heavy' && this.attackFrame<d.startup)this.vx*=.78;
        if(this.attackFrame>=total)this.attack=null;
        return;
      }
      if(this.attack==='special'){this.updateSpecial(target);return;}
      if(this.attack==='ultimate'){this.updateUltimate(target);return;}
    }
    attackBox(range,h,y){
      return {x:this.facing>0?this.x+10:this.x-range-10,y:this.y+y,w:range,h};
    }
    updateSpecial(target){
      const t=this.attackFrame, type=this.data.specialType, c=this.data.accent, dmg=95*this.data.power;
      if(type==='wave'){
        if(t===12) projectiles.push(new Projectile(this,this.x+this.facing*45,this.y-70,this.facing*9,c,dmg,'energy',{w:72,h:30,knock:8}));
        if(t>34)this.attack=null;
      } else if(type==='blink'){
        if(t===5){this.makeAfterImage(.65);this.invuln=10;this.x=clamp(this.x+this.facing*145,45,W-45);}
        if(t>=7&&t<=12&&!this.attackHasHit){const b=this.attackBox(95,86,-96);if(rectsOverlap(b,target.hurtbox())){target.receiveHit(this,dmg*1.05,this.facing*11,-3,{color:c,hitstop:8});this.attackHasHit=true;}}
        if(t>26)this.attack=null;
      } else if(type==='slam'){
        if(t===14){shake=13;for(let i=0;i<22;i++)particles.push(new Particle(this.x+rand(-80,80),FLOOR-6,'#f39a4a',{vx:rand(-6,6),vy:rand(-10,-2),life:30,size:rand(4,10)}));
          if(Math.abs(target.x-this.x)<150)target.receiveHit(this,dmg*1.18,this.facing*8,-7,{color:c,hitstop:10});}
        if(t>39)this.attack=null;
      } else if(type==='orb'){
        if(t===13)projectiles.push(new Projectile(this,this.x+this.facing*48,this.y-80,this.facing*6.8,c,dmg*1.02,'energy',{w:58,h:58,life:150,knock:7}));
        if(t>38)this.attack=null;
      } else if(type==='lunge'){
        if(t<13)this.vx=this.facing*10.5;
        if(t>=7&&t<=16&&!this.attackHasHit){const b=this.attackBox(150,48,-82);if(rectsOverlap(b,target.hurtbox())){target.receiveHit(this,dmg*1.10,this.facing*13,-2,{color:c,hitstop:9});this.attackHasHit=true;}}
        if(t>30)this.attack=null;
      } else if(type==='gun'){
        if([8,14,20].includes(t))projectiles.push(new Projectile(this,this.x+this.facing*45,this.y-88,this.facing*15,c,dmg*.42,'bullet',{w:42,h:12,life:85,knock:3.3}));
        if(t>35)this.attack=null;
      } else if(type==='seal'){
        if(t===12)projectiles.push(new Projectile(this,this.x+this.facing*65,this.y-74,this.facing*5.2,c,dmg*.9,'seal',{w:52,h:52,life:180,knock:5}));
        if(t>39)this.attack=null;
      } else if(type==='maul'){
        if(t<16)this.vx=this.facing*8.5;
        if([7,12,17].includes(t)){const b=this.attackBox(82,78,-94);if(rectsOverlap(b,target.hurtbox()))target.receiveHit(this,dmg*.42,this.facing*4,-2,{color:c,hitstop:4});}
        if(t>30)this.attack=null;
      } else if(type==='armor'){
        if(t===1)this.armor=28;
        if(t>=14&&t<=20&&!this.attackHasHit){const b=this.attackBox(132,92,-103);if(rectsOverlap(b,target.hurtbox())){target.receiveHit(this,dmg*1.28,this.facing*14,-6,{color:c,hitstop:11});this.attackHasHit=true;}}
        if(t>42){this.armor=0;this.attack=null;}
      } else if(type==='drone'){
        if(t===12){
          const drone=new Projectile(this,this.x+this.facing*55,this.y-120,0,c,dmg*.6,'drone',{w:40,h:28,life:130,knock:4});
          projectiles.push(drone);
          setTimeout(()=>{},0);
        }
        if(t>36)this.attack=null;
      }
    }
    updateUltimate(target){
      const t=this.attackFrame, c=this.data.accent, p=this.data.power;
      this.vx*=.7;
      if(t===1){for(let i=0;i<24;i++)particles.push(new Particle(this.x,this.y-70,c,{vx:rand(-9,9),vy:rand(-9,6),life:36,size:rand(3,8),gravity:0}));}
      const type=this.data.specialType;
      if(type==='gun'){
        if(t>=18&&t<=54&&t%4===0) projectiles.push(new Projectile(this,this.x+this.facing*48,this.y-rand(45,120),this.facing*17,c,34*p,'bullet',{life:90,knock:2}));
      } else if(type==='orb'||type==='seal'||type==='drone'){
        if([18,26,34,42,50].includes(t))projectiles.push(new Projectile(this,this.x+this.facing*30,this.y-rand(55,130),this.facing*rand(6,11),c,44*p,type==='seal'?'seal':'energy',{w:rand(42,70),h:rand(30,60),life:120,knock:4,pierce:false}));
      } else {
        if(t>=16&&t<=49){
          this.vx=this.facing*(type==='armor'?5.8:10.8);
          if(t%7===0){this.makeAfterImage(.55);const b=this.attackBox((type==='lunge'?170:110)*this.data.reach,90,-100);if(rectsOverlap(b,target.hurtbox()))target.receiveHit(this,48*p,this.facing*4.5,-1.8,{color:c,hitstop:4,noComboReset:true});}
        }
      }
      if(t===58){
        shake=22; flash=9;
        const dist=Math.abs(target.x-this.x);
        if(dist<280 || ['gun','orb','seal','drone'].includes(type)) target.receiveHit(this,150*p,this.facing*15,-8,{color:c,hitstop:13,heavy:true});
        for(let i=0;i<32;i++)particles.push(new Particle(target.x+rand(-70,70),target.y-rand(30,150),c,{vx:rand(-10,10),vy:rand(-10,4),life:34,size:rand(3,10)}));
      }
      if(t>82)this.attack=null;
    }
    receiveHit(attacker, rawDamage, kx, ky, opts={}){
      if(this.invuln>0)return;
      let damage=rawDamage/this.data.defense;
      const fromFront=(attacker.x<this.x&&this.facing<0)||(attacker.x>this.x&&this.facing>0);
      if(this.blocking && fromFront && !opts.unblockable){
        damage*=.2; this.hp-=damage; this.blockstun=9; this.vx=kx*.25; this.meter=clamp(this.meter+8,0,100);
        burst(this.x+this.facing*28,this.y-76,'#9fb6d8',10); audio.tone(150,.06,'square',.03,80); return;
      }
      if(this.armor>0){damage*=.55;this.armor-=8;}
      this.hp=clamp(this.hp-damage,0,this.maxHp);this.stun=opts.heavy?22:14;this.vx=kx;this.vy=ky;this.onGround=false;
      this.meter=clamp(this.meter+damage*.045,0,100);attacker.meter=clamp(attacker.meter+damage*.065,0,100);
      attacker.combo++; attacker.comboTimer=70; this.lastHitBy=attacker;
      const c=opts.color||attacker.data.accent;burst(this.x-attacker.facing*10,this.y-75,c,opts.heavy?22:12);
      shake=Math.max(shake,opts.heavy?13:6);globalHitstop=Math.max(globalHitstop,opts.hitstop||6);audio.hit(opts.heavy?1.3:.8);
      floatTexts.push({x:this.x,y:this.y-135,text:`${Math.round(damage)}`,color:c,life:45});
      if(this.hp<=0){this.dead=true;this.stun=999;this.vx=kx*1.5;this.vy=-9;shake=24;flash=10;}
    }
    makeAfterImage(alpha=.25){afterImages.push({fighter:this,x:this.x,y:this.y,facing:this.facing,life:14,max:14,alpha});}
    draw(alpha=1, ox=0, oy=0){drawFighterSprite(this,this.x+ox,this.y+oy,alpha);}
  }

  function burst(x,y,color,count=12){
    for(let i=0;i<count;i++)particles.push(new Particle(x,y,color,{vx:rand(-8,8),vy:rand(-8,4),life:rand(16,30),size:rand(3,8),gravity:.18,shape:i%3===0?'line':'square'}));
  }

  function drawFighterSprite(f,x,y,alpha=1, scale=1){
    const d=f.data, face=f.facing;
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(face*scale,scale);ctx.globalAlpha=alpha;
    const bob=f.onGround&&!f.attack?Math.sin(frame*.09+f.player)*2:0;ctx.translate(0,bob);
    if(f.blocking){ctx.globalAlpha*=.78;ctx.fillStyle=rgba('#9fd5ff',.18);ctx.strokeStyle=rgba('#9fd5ff',.65);ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(25,-72,46,78,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
    // shadow handled outside. Legs
    ctx.fillStyle='#11151d'; ctx.fillRect(-22,-42,18,42);ctx.fillRect(8,-42,18,42);
    ctx.fillStyle=d.dark;ctx.fillRect(-27,-96,54,60);
    ctx.fillStyle=d.color;ctx.fillRect(-31,-91,10,48);ctx.fillRect(21,-91,10,48);
    // head + hair/helmet
    const skin=['valen'].includes(d.id)?'#b9beca':(['brakk','thorn'].includes(d.id)?'#a96a43':'#d5a17f');
    ctx.fillStyle=skin;ctx.fillRect(-18,-128,36,34);
    if(d.id==='valen'){
      ctx.fillStyle='#2a2b39';ctx.fillRect(-23,-136,46,44);ctx.fillStyle=d.accent;ctx.fillRect(6,-119,12,4);
    } else {
      ctx.fillStyle=d.id==='nyra'?'#eee7ff':d.id==='eira'?'#a7dcff':d.id==='raven'?'#d9dce6':d.id==='thorn'?'#c74338':'#171923';
      ctx.fillRect(-23,-136,46,18);ctx.fillRect(-27,-130,14,20);ctx.fillRect(12,-132,18,16);
    }
    // scarf / chest accent
    ctx.fillStyle=d.accent;ctx.fillRect(-23,-93,46,7);
    // arms pose
    let armY=-79, armX=26;
    if(f.attack){armX=37;armY=-72;}
    ctx.fillStyle=skin;ctx.fillRect(18,armY,34,12);ctx.fillStyle=d.dark;ctx.fillRect(-40,-82,28,13);
    // weapon
    drawWeapon(d, f, armX+20, armY+6);
    // attack trails
    if(f.attack==='light'||f.attack==='heavy'||f.attack==='special'||f.attack==='ultimate') drawAttackTrail(f);
    // hit flash
    if(f.stun>0 && frame%4<2){ctx.globalCompositeOperation='source-atop';ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillRect(-48,-144,104,148);}
    ctx.restore();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  }

  function drawWeapon(d,f,x,y){
    ctx.save();ctx.translate(x,y);
    const active=f.attack && f.attackFrame>2;
    const ang=active?-.55:.18;ctx.rotate(ang);
    if(d.weapon==='sword'){ctx.fillStyle='#dce4ef';ctx.fillRect(0,-4,68,8);ctx.fillStyle=d.accent;ctx.fillRect(-10,-8,18,16);}
    else if(d.weapon==='dual'){ctx.fillStyle='#dcc7ff';ctx.fillRect(-5,-3,49,6);ctx.fillRect(-26,9,45,6);}
    else if(d.weapon==='gauntlet'){ctx.fillStyle='#24262d';ctx.fillRect(-9,-16,40,32);ctx.fillStyle=d.color;ctx.fillRect(16,-12,18,24);}
    else if(d.weapon==='focus'){ctx.fillStyle=d.accent;ctx.shadowBlur=16;ctx.shadowColor=d.accent;ctx.beginPath();ctx.arc(18,0,12,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
    else if(d.weapon==='spear'){ctx.fillStyle='#aeb8ae';ctx.fillRect(-35,-3,112,6);ctx.fillStyle=d.accent;ctx.beginPath();ctx.moveTo(84,0);ctx.lineTo(66,-10);ctx.lineTo(66,10);ctx.closePath();ctx.fill();}
    else if(d.weapon==='gun'){ctx.fillStyle='#30343c';ctx.fillRect(-5,-7,53,14);ctx.fillStyle=d.color;ctx.fillRect(12,-10,23,5);}
    else if(d.weapon==='talisman'){ctx.fillStyle='#fff0db';ctx.fillRect(7,-18,22,36);ctx.fillStyle=d.color;ctx.fillRect(15,-14,5,28);}
    else if(d.weapon==='claw'){ctx.strokeStyle='#cbd5d8';ctx.lineWidth=4;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(3,i*7-8);ctx.lineTo(54,i*4-10);ctx.stroke();}}
    else if(d.weapon==='greatsword'){ctx.fillStyle='#535366';ctx.fillRect(-6,-9,87,18);ctx.fillStyle=d.accent;ctx.fillRect(58,-7,22,14);}
    else if(d.weapon==='cannon'){ctx.fillStyle='#303842';ctx.fillRect(-10,-13,64,26);ctx.fillStyle=d.accent;ctx.fillRect(38,-9,18,18);ctx.fillStyle='#ef9b35';ctx.fillRect(52,-5,8,10);}
    ctx.restore();
  }

  function drawAttackTrail(f){
    const t=f.attackFrame,d=f.data;
    if((f.attack==='light'&&t>=3&&t<=10)||(f.attack==='heavy'&&t>=8&&t<=18)||(f.attack==='special'&&t>=5&&t<=21)||(f.attack==='ultimate'&&t>=12&&t<=62)){
      ctx.save();ctx.globalAlpha=.34;ctx.strokeStyle=d.accent;ctx.lineWidth=f.attack==='ultimate'?14:8;ctx.shadowBlur=18;ctx.shadowColor=d.accent;
      ctx.beginPath();ctx.arc(24,-74,f.attack==='heavy'?92:74,-1.0,.9);ctx.stroke();ctx.restore();
    }
  }

  function startMatch(){
    resetTransient();
    stage=pick(STAGES); roundWins=[0,0]; round=1; startRound(); gameState='match';
  }
  function startRound(){
    resetTransient();timer=99*60;introTimer=150;roundOverTimer=0;
    const p1=FIGHTERS[p1Index],p2=FIGHTERS[p2Index];
    fighters=[new Fighter(p1,1,360,1,false),new Fighter(p2,2,920,-1,mode!=='VERSUS LOCAL')];
    if(mode==='TREINO'){fighters[1].maxHp=999999;fighters[1].hp=999999;}
  }

  function updateTitle(){
    if(input.tap('ArrowUp')||input.tap('KeyW')){modeIndex=(modeIndex+modes.length-1)%modes.length;audio.menu();}
    if(input.tap('ArrowDown')||input.tap('KeyS')){modeIndex=(modeIndex+1)%modes.length;audio.menu();}
    if(input.tap('Enter')||input.tap('Space')){mode=modes[modeIndex];selectIndex=p1Index;selectingPlayer=1;gameState='select';audio.select();}
  }
  function updateSelect(){
    const cols=5;
    if(input.tap('ArrowLeft')||input.tap('KeyA')){selectIndex=(selectIndex+FIGHTERS.length-1)%FIGHTERS.length;audio.menu();}
    if(input.tap('ArrowRight')||input.tap('KeyD')){selectIndex=(selectIndex+1)%FIGHTERS.length;audio.menu();}
    if(input.tap('ArrowUp')||input.tap('KeyW')){selectIndex=(selectIndex-cols+FIGHTERS.length)%FIGHTERS.length;audio.menu();}
    if(input.tap('ArrowDown')||input.tap('KeyS')){selectIndex=(selectIndex+cols)%FIGHTERS.length;audio.menu();}
    if(input.tap('Escape')){gameState='title';audio.menu();return;}
    if(input.tap('Enter')||input.tap('Space')||input.tap('KeyJ')){
      if(selectingPlayer===1){
        p1Index=selectIndex;audio.select();
        if(mode==='VERSUS LOCAL'){selectingPlayer=2;selectIndex=p2Index;}
        else {do{p2Index=Math.floor(Math.random()*FIGHTERS.length);}while(p2Index===p1Index);startMatch();}
      } else {p2Index=selectIndex;audio.select();startMatch();}
    }
  }
  function updateMatch(){
    if(input.tap('Escape')){paused=!paused;audio.menu();}
    if(paused)return;
    if(globalHitstop>0){globalHitstop--;return;}
    if(introTimer>0){introTimer--;return;}
    if(roundOverTimer>0){
      roundOverTimer--;
      if(roundOverTimer===0){
        if(roundWins[0]>=2||roundWins[1]>=2){gameState='result';}
        else {round++;startRound();}
      }
      return;
    }
    if(timer>0&&mode!=='TREINO')timer--;
    fighters[0].update(fighters[1]);fighters[1].update(fighters[0]);
    // prevent deep overlap
    const dx=fighters[1].x-fighters[0].x;
    if(Math.abs(dx)<58 && fighters[0].onGround&&fighters[1].onGround){const push=(58-Math.abs(dx))*.12;fighters[0].x-=Math.sign(dx||1)*push;fighters[1].x+=Math.sign(dx||1)*push;}
    projectiles.forEach(p=>p.update());projectiles=projectiles.filter(p=>p.life>0&&p.x>-100&&p.x<W+100);
    particles.forEach(p=>p.update());particles=particles.filter(p=>p.life>0);
    afterImages.forEach(a=>a.life--);afterImages=afterImages.filter(a=>a.life>0);
    floatTexts.forEach(t=>{t.y-=1.2;t.life--;});floatTexts=floatTexts.filter(t=>t.life>0);
    if(mode==='TREINO'&&fighters[1].hp<999000)fighters[1].hp=999999;
    if(fighters.some(f=>f.dead)||timer<=0){
      let winner=0;
      if(timer<=0)winner=fighters[0].hp/fighters[0].maxHp >= fighters[1].hp/fighters[1].maxHp ? 0:1;
      else winner=fighters[0].dead?1:0;
      roundWins[winner]++;roundOverTimer=190;
    }
  }
  function updateResult(){
    if(input.tap('Enter')||input.tap('Space')){gameState='select';selectingPlayer=1;selectIndex=p1Index;audio.select();}
    if(input.tap('Escape')){gameState='title';audio.menu();}
  }

  function update(){
    frame++;
    if(shake>0)shake*=.86;if(shake<.2)shake=0;if(flash>0)flash--;
    if(gameState==='title')updateTitle();
    else if(gameState==='select')updateSelect();
    else if(gameState==='match')updateMatch();
    else if(gameState==='result')updateResult();
    input.endFrame();
  }

  function fillText(text,x,y,size=24,color='#fff',align='left',weight=800){
    ctx.font=`${weight} ${size}px ui-sans-serif, system-ui, sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,x,y);
  }
  function panel(x,y,w,h,alpha=.72){ctx.fillStyle=`rgba(7,10,16,${alpha})`;ctx.fillRect(x,y,w,h);ctx.strokeStyle='rgba(255,255,255,.12)';ctx.strokeRect(x+.5,y+.5,w-1,h-1);}

  function drawBackdrop(){
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#090b14');g.addColorStop(1,'#030407');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    for(let i=0;i<28;i++){const x=(i*173+frame*.08)%W;const y=(i*79)%H;ctx.fillStyle=`rgba(255,255,255,${.04+(i%4)*.015})`;ctx.fillRect(x,y,2,2);}
  }
  function drawTitle(){
    drawBackdrop();
    ctx.save();ctx.translate(W/2,170);ctx.rotate(-.04);fillText('RIFTBOUND',0,0,92,'#f4f5f9','center',950);fillText('// ARENA',0,75,28,'#ff4a76','center',900);ctx.restore();
    fillText('PROTÓTIPO DE COMBATE • HTML5',W/2,290,14,'#7f899d','center',800);
    const startY=380;
    modes.forEach((m,i)=>{
      const sel=i===modeIndex;if(sel){ctx.fillStyle='rgba(255,61,110,.14)';ctx.fillRect(W/2-205,startY+i*60-24,410,48);ctx.fillStyle='#ff3d6e';ctx.fillRect(W/2-205,startY+i*60-24,5,48);}
      fillText(sel?`▶  ${m}`:m,W/2,startY+i*60,22,sel?'#fff':'#7f899d','center',900);
    });
    fillText('↑ ↓ para escolher • ENTER para começar',W/2,H-70,14,'#687286','center',700);
    drawTitleFighters();
  }
  function drawTitleFighters(){
    const left=new Fighter(FIGHTERS[0],1,0,1),right=new Fighter(FIGHTERS[1],2,0,-1);left.attack='heavy';left.attackFrame=13;right.attack='special';right.attackFrame=12;
    ctx.save();ctx.translate(165,605);ctx.scale(1.25,1.25);drawFighterSprite(left,0,0,.85);ctx.restore();
    ctx.save();ctx.translate(W-165,605);ctx.scale(1.25,1.25);drawFighterSprite(right,0,0,.85);ctx.restore();
  }

  function drawSelect(){
    drawBackdrop();fillText('SELEÇÃO DE PERSONAGEM',55,54,32,'#fff','left',950);fillText(mode,55,91,14,'#ff557f','left',850);
    fillText(selectingPlayer===1?'ESCOLHA O P1':'ESCOLHA O P2',W-55,70,18,'#aab4c6','right',900);
    const cardW=205,cardH=180,gap=14,startX=56,startY=128;
    FIGHTERS.forEach((d,i)=>{
      const col=i%5,row=Math.floor(i/5),x=startX+col*(cardW+gap),y=startY+row*(cardH+gap),sel=i===selectIndex;
      ctx.fillStyle=sel?rgba(d.color,.19):'rgba(14,18,26,.84)';ctx.fillRect(x,y,cardW,cardH);ctx.strokeStyle=sel?d.accent:'rgba(255,255,255,.12)';ctx.lineWidth=sel?3:1;ctx.strokeRect(x+.5,y+.5,cardW-1,cardH-1);
      const mini=new Fighter(d,1,0,1);mini.attack=sel?'light':null;mini.attackFrame=7;
      ctx.save();ctx.beginPath();ctx.rect(x,y,cardW,116);ctx.clip();ctx.translate(x+104,y+122);ctx.scale(.76,.76);drawFighterSprite(mini,0,0,1);ctx.restore();
      ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(x,y+115,cardW,65);
      fillText(`${String(i+1).padStart(2,'0')}  ${d.name}`,x+12,y+135,17,'#fff','left',950);fillText(d.role,x+12,y+159,12,d.accent,'left',800);
      if(i===p1Index){ctx.fillStyle='#ff3d6e';ctx.fillRect(x+cardW-38,y+8,30,22);fillText('P1',x+cardW-23,y+19,11,'#fff','center',950);}
      if(mode==='VERSUS LOCAL'&&i===p2Index){ctx.fillStyle='#4c9cff';ctx.fillRect(x+cardW-38,y+35,30,22);fillText('P2',x+cardW-23,y+46,11,'#fff','center',950);}
    });
    const d=FIGHTERS[selectIndex];panel(56,530,W-112,132,.82);fillText(`${d.name} — ${d.title}`,78,558,24,'#fff','left',950);fillText(`${d.weapon.toUpperCase()}  •  ${d.difficulty}  •  Especial: ${d.special}  •  Ultimate: ${d.ultimate}`,78,590,13,d.accent,'left',800);fillText(d.lore,78,622,13,'#aeb6c7','left',650);
    drawStat('VIDA',d.hp/1370,850,550,d.color);drawStat('VEL',d.speed/7.4,850,578,d.color);drawStat('DANO',d.power/1.25,850,606,d.color);
    fillText('ENTER confirmar • ESC voltar',W-55,H-36,13,'#6f798b','right',700);
  }
  function drawStat(label,val,x,y,color){fillText(label,x,y,11,'#8d97a8','left',850);ctx.fillStyle='rgba(255,255,255,.09)';ctx.fillRect(x+55,y-5,180,10);ctx.fillStyle=color;ctx.fillRect(x+55,y-5,180*clamp(val,0,1),10);}

  function drawStage(){
    const s=stage;const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,s.sky1);g.addColorStop(1,s.sky2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=.65;ctx.fillStyle=s.moon;ctx.beginPath();ctx.arc(1060,145,76,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    // distant city/ruins
    for(let i=0;i<18;i++){const x=i*86-20;const h=80+(i*37)%160;ctx.fillStyle=i%2?'rgba(8,11,16,.72)':'rgba(15,18,25,.75)';ctx.fillRect(x,FLOOR-180-h,72,h+180);ctx.fillStyle=rgba(s.glow,.14);for(let j=0;j<4;j++)ctx.fillRect(x+12+(j%2)*28,FLOOR-150-h+j*33,8,12);}
    // parallax fog
    ctx.fillStyle='rgba(255,255,255,.025)';for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse((i*310+frame*.25)%1500-100,390+i*26,210,45,0,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle=s.floor;ctx.fillRect(0,FLOOR,W,H-FLOOR);ctx.fillStyle=rgba(s.glow,.22);ctx.fillRect(0,FLOOR,W,4);
    for(let x=0;x<W;x+=64){ctx.strokeStyle='rgba(255,255,255,.035)';ctx.strokeRect(x,FLOOR+14,64,58);}
  }

  function drawHUD(){
    const a=fighters[0],b=fighters[1];
    const margin=55,barW=430,barH=30;
    ctx.fillStyle='rgba(3,5,9,.82)';ctx.fillRect(margin,38,barW,barH);ctx.fillRect(W-margin-barW,38,barW,barH);
    ctx.fillStyle=a.data.color;ctx.fillRect(margin+4,42,(barW-8)*clamp(a.hp/a.maxHp,0,1),barH-8);
    const br=(barW-8)*clamp(b.hp/b.maxHp,0,1);ctx.fillStyle=b.data.color;ctx.fillRect(W-margin-4-br,42,br,barH-8);
    fillText(a.data.name,margin,89,19,'#fff','left',950);fillText(b.data.name,W-margin,89,19,'#fff','right',950);
    // meters
    ctx.fillStyle='rgba(3,5,9,.82)';ctx.fillRect(margin,105,260,12);ctx.fillRect(W-margin-260,105,260,12);
    ctx.fillStyle=a.data.accent;ctx.fillRect(margin+2,107,256*(a.meter/100),8);ctx.fillStyle=b.data.accent;ctx.fillRect(W-margin-258,107,256*(b.meter/100),8);
    fillText(`${Math.ceil(timer/60)}`,W/2,60,36,'#fff','center',950);fillText(`ROUND ${round}`,W/2,96,12,'#9ba5b8','center',850);
    for(let i=0;i<2;i++){ctx.fillStyle=i<roundWins[0]?a.data.accent:'rgba(255,255,255,.15)';ctx.fillRect(margin+i*20,126,13,7);ctx.fillStyle=i<roundWins[1]?b.data.accent:'rgba(255,255,255,.15)';ctx.fillRect(W-margin-i*20-13,126,13,7);}
    if(a.combo>1&&a.comboTimer>0){fillText(`${a.combo} HIT`,75,210,30,a.data.accent,'left',950);}
    if(b.combo>1&&b.comboTimer>0){fillText(`${b.combo} HIT`,W-75,210,30,b.data.accent,'right',950);}
  }

  function drawMatch(){
    const sx=shake?rand(-shake,shake):0,sy=shake?rand(-shake*.35,shake*.35):0;
    ctx.save();ctx.translate(sx,sy);drawStage();
    // shadows
    fighters.forEach(f=>{ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(f.x,FLOOR+2,48,11,0,0,Math.PI*2);ctx.fill();});
    afterImages.forEach(a=>{const oldX=a.fighter.x,oldY=a.fighter.y,oldF=a.fighter.facing;a.fighter.x=a.x;a.fighter.y=a.y;a.fighter.facing=a.facing;drawFighterSprite(a.fighter,a.x,a.y,(a.life/a.max)*a.alpha);a.fighter.x=oldX;a.fighter.y=oldY;a.fighter.facing=oldF;});
    projectiles.forEach(p=>p.draw());fighters.forEach(f=>f.draw());particles.forEach(p=>p.draw());
    floatTexts.forEach(t=>fillText(t.text,t.x,t.y,16,t.color,'center',900));ctx.restore();
    drawHUD();
    if(introTimer>0){
      if(introTimer>95)fillText(`ROUND ${round}`,W/2,H/2-28,34,'#dce3ef','center',950);
      else if(introTimer>38)fillText('FIGHT!',W/2,H/2,72,'#fff','center',1000);
    }
    if(roundOverTimer>0){
      const winner=roundWins[0]+roundWins[1]===round? (roundWins[0]>roundWins[1]?fighters[0]:fighters[1]) : (fighters[0].dead?fighters[1]:fighters[0]);
      fillText('K.O.',W/2,H/2-15,82,'#fff','center',1000);fillText(`${winner.data.name} LEVA O ROUND`,W/2,H/2+58,18,winner.data.accent,'center',900);
    }
    if(paused){ctx.fillStyle='rgba(0,0,0,.62)';ctx.fillRect(0,0,W,H);fillText('PAUSADO',W/2,H/2-20,46,'#fff','center',950);fillText('ESC para continuar',W/2,H/2+35,15,'#9ca6b8','center',750);}
    if(flash>0){ctx.fillStyle=`rgba(255,255,255,${Math.min(.55,flash/20)})`;ctx.fillRect(0,0,W,H);}
  }

  function drawResult(){
    drawBackdrop();const winner=roundWins[0]>roundWins[1]?FIGHTERS[p1Index]:FIGHTERS[p2Index];
    fillText('VENCEDOR',W/2,125,18,'#7f899d','center',900);fillText(winner.name,W/2,205,76,winner.accent,'center',1000);fillText(winner.title,W/2,265,22,'#fff','center',800);
    const f=new Fighter(winner,1,0,1);f.attack='ultimate';f.attackFrame=35;ctx.save();ctx.translate(W/2,560);ctx.scale(1.7,1.7);drawFighterSprite(f,0,0,1);ctx.restore();
    fillText('ENTER — nova luta     ESC — menu',W/2,H-58,15,'#8791a4','center',800);
  }

  function render(){
    ctx.clearRect(0,0,W,H);
    if(gameState==='title')drawTitle();
    else if(gameState==='select')drawSelect();
    else if(gameState==='match')drawMatch();
    else if(gameState==='result')drawResult();
  }

  let last=performance.now(),acc=0;const step=1000/60;
  function loop(now){
    let dt=Math.min(80,now-last);last=now;acc+=dt;
    while(acc>=step){update();acc-=step;}
    render();requestAnimationFrame(loop);
  }

  // Remove loading overlay only after the game is ready.
  document.getElementById('boot').classList.add('hidden');
  requestAnimationFrame(loop);
})();
