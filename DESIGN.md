# RIFTBOUND // Arena — Documento técnico de direção

## Objetivo

Criar um jogo de luta 2D de navegador com filosofia semelhante à de engines de personagens modulares: a engine é estável e o elenco cresce por dados, sprites e golpes. O foco é evitar que cada novo personagem exija criar um jogo novo.

## Pilares

### 1. Produção em massa
Um personagem comum deve reutilizar movimentação, colisão, HUD, física, defesa e infraestrutura de golpes. O trabalho exclusivo deve ficar concentrado em arte, parâmetros e 1–3 mecânicas que definem identidade.

### 2. Silhueta antes de detalhe
Personagens precisam ser reconhecíveis pelo formato geral: espada grande, lança longa, manoplas, cabelos, capacete, arma de fogo etc. Isso permite sprites simples continuarem legíveis em movimento.

### 3. Impacto barato
Sensação de peso vem de hit-stop, screen shake, partículas, knockback, som, trail e timing. Esses recursos são muito mais baratos que centenas de frames desenhados.

### 4. Efeitos reutilizáveis
Fogo, gelo, impacto, corte, eletricidade, poeira e explosões devem existir como bibliotecas independentes dos sprites dos personagens.

## Escala de personagem

O protótipo usa uma caixa aproximada de 64×124 pixels lógicos dentro de um canvas 1280×720. Quando spritesheets reais entrarem, o tamanho visual pode ser maior desde que a origem do personagem continue consistente no pé central.

## Kit mínimo de animações

- Idle: 4–6 frames.
- Walk: 6–8.
- Jump: 2–4.
- Guard: 1–2.
- Hurt: 2.
- Light: 3–5.
- Heavy: 4–7.
- Special: 5–10.
- Ultimate: 8–16.
- KO: 4–8.

Meta aproximada: 39–68 frames por lutador base, sem contar efeitos. Isso é pequeno o suficiente para produzir muito elenco, mas grande o suficiente para não parecer estático.

## Sistema de combate atual

Cada lutador possui:

- vida máxima;
- velocidade horizontal;
- força de pulo;
- multiplicador de dano;
- multiplicador defensivo;
- multiplicador de alcance;
- light;
- heavy;
- especial;
- ultimate;
- block;
- hitstun;
- blockstun;
- knockback;
- meter de 0 a 100;
- contador de combo.

O especial é escolhido por `specialType`, permitindo prototipar rapidamente arquétipos sem lógica nova.

## Arquétipos atuais

1. Kael — espadachim equilibrado.
2. Nyra — rushdown/assassina.
3. Brakk — grappler/brutamontes conceitual.
4. Eira — zoner mágico.
5. Zen — footsies/alcance.
6. Raven — atirador.
7. Kaede — controle/suporte.
8. Thorn — pressão feral.
9. Valen — tanque pesado.
10. Lumi — tecnológica/trapper.

## Caminho para spritesheets reais

A função `drawFighterSprite()` é o ponto temporário de renderização procedural. Na próxima fase, ela deve virar um renderer que seleciona uma animação conforme o estado atual do lutador.

Estado lógico → animação:

- parado → idle
- |vx| > limite → walk
- no ar → jump
- blocking → guard
- stun > 0 → hurt
- attack = light → light
- attack = heavy → heavy
- attack = special → special
- attack = ultimate → ultimate
- dead → ko

A lógica de dano não deve depender do frame visual. Hitboxes ficam na engine e apenas sincronizam seus tempos com a animação.

## Estrutura futura de dados por golpe

```js
{
  id: 'light_1',
  animation: 'light',
  startup: 4,
  active: 5,
  recovery: 9,
  damage: 55,
  hitbox: { x: 10, y: -82, w: 76, h: 58 },
  knockback: { x: 4.7, y: -1.4 },
  hitstop: 5,
  meterGain: 4
}
```

Com isso, combos e golpes podem migrar de código para arquivos de dados.

## Prioridade de desenvolvimento

### Fase A — vertical slice atual
Base de combate, 10 protótipos, seleção, CPU, rounds e efeitos.

### Fase B — sprites reais
Converter 2 personagens primeiro. Não desenhar os 10 antes de provar o pipeline.

### Fase C — profundidade de combate
Crouch, throws, air attacks, cancels, command inputs, tech/recovery e frame data mais precisa.

### Fase D — conteúdo
Mais stages, música, personagens, chefes, paletas, arcade ladder e unlocks.

### Fase E — persistência
Save local, opções, remapeamento de controles e estatísticas.

### Fase F — online
Só depois do combate estar determinístico. Rollback exige mudanças arquiteturais e não deve ser improvisado em cima de uma física variável.

## Regra para novos personagens

Um personagem só entra como “completo” quando possui:

1. visual reconhecível;
2. função clara;
3. uma força marcante;
4. uma fraqueza real;
5. especial que altera a forma de jogar;
6. ultimate com identidade;
7. pelo menos uma cor/paleta alternativa;
8. matchup testado contra Kael, usado como referência de equilíbrio.

## Filosofia de balanceamento

Kael é a unidade de referência:

- HP ≈ 1000;
- speed ≈ 5.7;
- power = 1.00;
- defense = 1.00;
- reach ≈ 1.05.

Aumentar muito um eixo exige reduzir outro. Um tanque pode ter 1350 HP, mas deve perder mobilidade. Um assassino com velocidade muito alta deve possuir menos vida ou alcance. Um zoner forte a distância deve sofrer quando pressionado.
