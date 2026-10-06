// Minecraft 1.21.1 - NeoForge - KubeJS 7.x
//
// Faz com que minecraft:enchanting_table só possa existir no Overworld.
// No Overworld, a mesa continua completamente normal.
// Em qualquer outra dimensão:
// - mesas colocadas são apagadas;
// - itens dropados são apagados;
// - mesas no inventário do jogador são removidas;
// - mesas antigas já colocadas perto dos jogadores também são apagadas.

const ENCHANTING_TABLE = 'minecraft:enchanting_table'
const OVERWORLD = 'minecraft:overworld'

function isOverworld(level) {
    return String(level.dimension) === OVERWORLD
}

// Remove imediatamente qualquer mesa colocada fora do Overworld.
BlockEvents.placed(ENCHANTING_TABLE, event => {
    if (isOverworld(event.level)) return

    event.block.set('minecraft:air')
})

// Se uma mesa já existente fora do Overworld for usada, ela desaparece.
BlockEvents.rightClicked(ENCHANTING_TABLE, event => {
    if (isOverworld(event.level)) return

    event.block.set('minecraft:air')
    event.cancel()
})

// Remove mesas de encantamento que surgirem como item dropado fora do Overworld.
EntityEvents.spawned('minecraft:item', event => {
    const entity = event.entity

    if (isOverworld(entity.level)) return
    if (!entity.item || entity.item.id !== ENCHANTING_TABLE) return

    entity.discard()
})

// Impede que uma mesa dropada fora do Overworld seja coletada.
// Também apaga a entidade caso ela já existisse antes do script carregar.
ItemEvents.canPickUp(ENCHANTING_TABLE, event => {
    if (isOverworld(event.player.level)) return

    event.itemEntity.discard()
    event.cancel()
})

// Remove imediatamente a mesa caso ela apareça no inventário
// enquanto o jogador estiver fora do Overworld.
PlayerEvents.inventoryChanged(ENCHANTING_TABLE, event => {
    if (isOverworld(event.player.level)) return

    event.player.runCommandSilent(`clear @s ${ENCHANTING_TABLE}`)
})

// Limpeza de segurança a cada 2 segundos para mesas antigas/preexistentes.
// O cubo de 31 x 31 x 31 blocos fica abaixo do limite do comando /fill.
PlayerEvents.tick(event => {
    const player = event.player
    const level = player.level

    if (isOverworld(level)) return
    if (level.levelData.gameTime % 40 !== 0) return

    // Remove mesas carregadas no inventário.
    player.runCommandSilent(`clear @s ${ENCHANTING_TABLE}`)

    // Remove mesas dropadas no chão próximas ao jogador.
    player.runCommandSilent(
        `kill @e[type=minecraft:item,distance=..32,nbt={Item:{id:"${ENCHANTING_TABLE}"}}]`
    )

    // Remove mesas já colocadas no mundo, inclusive mesas antigas.
    player.runCommandSilent(
        `fill ~-15 ~-15 ~-15 ~15 ~15 ~15 minecraft:air replace ${ENCHANTING_TABLE}`
    )
})
