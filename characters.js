(() => {
  'use strict';

  const FIGHTERS = [
    {
      id:'kael', name:'KAEL', title:'O Fragmentado', role:'Espadachim', weapon:'sword',
      color:'#d92f43', accent:'#ff8295', dark:'#171a23', hp:1000, speed:5.7, jump:15.2, power:1.00, defense:1.00, reach:1.05,
      difficulty:'Fácil', special:'Corte Crescente', ultimate:'Ruptura', specialType:'wave',
      lore:'Um duelista marcado por uma fenda. Cada corte deixa um eco atrasado no espaço.'
    },
    {
      id:'nyra', name:'NYRA', title:'A Caçadora do Vazio', role:'Assassina', weapon:'dual',
      color:'#9a4df3', accent:'#d7a6ff', dark:'#17131f', hp:860, speed:7.4, jump:16.6, power:.92, defense:.88, reach:.92,
      difficulty:'Média', special:'Passo do Vazio', ultimate:'Mil Cortes', specialType:'blink',
      lore:'Velocidade absurda e duas lâminas. Excelente em entrar, explodir e desaparecer.'
    },
    {
      id:'brakk', name:'BRAKK', title:'O Colosso', role:'Brutamontes', weapon:'gauntlet',
      color:'#ef7b28', accent:'#ffc073', dark:'#241811', hp:1250, speed:4.25, jump:12.8, power:1.25, defense:1.13, reach:.90,
      difficulty:'Fácil', special:'Impacto Sísmico', ultimate:'Queda do Titã', specialType:'slam',
      lore:'Uma muralha que aprendeu a socar. Lento, mas cada acerto muda o ritmo da luta.'
    },
    {
      id:'eira', name:'EIRA', title:'A Tecelã', role:'Maga', weapon:'focus',
      color:'#3e9dea', accent:'#a4dcff', dark:'#101c28', hp:900, speed:5.1, jump:14.5, power:1.00, defense:.92, reach:1.30,
      difficulty:'Média', special:'Orbe Dimensional', ultimate:'Horizonte Partido', specialType:'orb',
      lore:'Controla distância e espaço. Seu melhor lugar é exatamente onde o oponente não alcança.'
    },
    {
      id:'zen', name:'ZEN', title:'O Nômade', role:'Lanceiro', weapon:'spear',
      color:'#42a46c', accent:'#9ff2bd', dark:'#102018', hp:980, speed:6.05, jump:15.0, power:1.03, defense:.98, reach:1.35,
      difficulty:'Média', special:'Investida Verde', ultimate:'Linha do Horizonte', specialType:'lunge',
      lore:'Domina o meio da tela com uma lança longa e mobilidade precisa.'
    },
    {
      id:'raven', name:'RAVEN', title:'O Atirador', role:'Atirador', weapon:'gun',
      color:'#e7b634', accent:'#fff0a2', dark:'#202019', hp:900, speed:5.55, jump:14.2, power:.95, defense:.90, reach:1.45,
      difficulty:'Média', special:'Disparo Perfurante', ultimate:'Chuva de Chumbo', specialType:'gun',
      lore:'Mantém pressão de longe, mas precisa administrar espaço quando encurralado.'
    },
    {
      id:'kaede', name:'KAEDE', title:'A Onmyoji', role:'Suporte', weapon:'talisman',
      color:'#ed5997', accent:'#ffc0dc', dark:'#25131c', hp:920, speed:5.3, jump:14.8, power:.98, defense:.95, reach:1.20,
      difficulty:'Média', special:'Ofuda Vinculante', ultimate:'Procissão dos Espíritos', specialType:'seal',
      lore:'Talismãs e espíritos alteram a arena e interrompem avanços previsíveis.'
    },
    {
      id:'thorn', name:'THORN', title:'O Selvagem', role:'Feral', weapon:'claw',
      color:'#d64036', accent:'#67e4d4', dark:'#221313', hp:1020, speed:6.65, jump:16.1, power:1.08, defense:.96, reach:.96,
      difficulty:'Difícil', special:'Predação', ultimate:'Lua Sangrenta', specialType:'maul',
      lore:'Pressão contínua e saltos agressivos. Fica mais perigoso quanto mais perto chega.'
    },
    {
      id:'valen', name:'VALEN', title:'O Cavaleiro Caído', role:'Tanque', weapon:'greatsword',
      color:'#7553c6', accent:'#bf9cff', dark:'#171520', hp:1370, speed:3.95, jump:12.3, power:1.18, defense:1.22, reach:1.18,
      difficulty:'Média', special:'Ruptura Sombria', ultimate:'Julgamento do Abismo', specialType:'armor',
      lore:'Uma fortaleza ambulante. Aguenta pressão e transforma um erro adversário em desastre.'
    },
    {
      id:'lumi', name:'LUMI', title:'A Artífice', role:'Tecnológica', weapon:'cannon',
      color:'#1fb6c4', accent:'#ffc05b', dark:'#102023', hp:940, speed:5.0, jump:14.0, power:1.02, defense:.95, reach:1.35,
      difficulty:'Difícil', special:'Drone Sentinela', ultimate:'Protocolo Zero', specialType:'drone',
      lore:'Armadilhas e tecnologia modular. Domina a luta quando consegue preparar o terreno.'
    }
  ];


  const STAGES = [
    {name:'NEON DEAD', sky1:'#080b19', sky2:'#2a1237', moon:'#ec548e', floor:'#10141c', glow:'#c43dff'},
    {name:'BOSQUE DAS ESTÁTUAS', sky1:'#07150f', sky2:'#173829', moon:'#9bdbba', floor:'#101a14', glow:'#52d590'},
    {name:'FORTALEZA INVERTIDA', sky1:'#0d0d18', sky2:'#242145', moon:'#aab0ff', floor:'#171625', glow:'#7c6ff0'}
  ];

  window.RIFTBOUND_DATA = { FIGHTERS, STAGES };
})();
