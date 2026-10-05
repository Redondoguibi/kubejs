// Minecraft 1.21.1 - NeoForge - KubeJS 7.x
//
// Desativa minecraft:enchanted_book no modpack sem remover o item do registry.
// O item continua existindo internamente para evitar incompatibilidades,
// mas não pode ser obtido/mantido normalmente pelos jogadores.

const ENCHANTED_BOOK = 'minecraft:enchanted_book'

// Remove qualquer receita cujo resultado seja um livro encantado.
ServerEvents.recipes(event => {
    event.remove({ output: ENCHANTED_BOOK })
})

// Remove completamente a entrada do JEI / EMI / REI no KubeJS 1.21+.
RecipeViewerEvents.removeEntriesCompletely('item', event => {
    event.remove(ENCHANTED_BOOK)
})

// Impede jogadores de coletarem livros encantados dropados.
ItemEvents.canPickUp(ENCHANTED_BOOK, event => {
    event.cancel()
})

// Impede livros encantados de permanecerem como entidades de item no mundo.
EntityEvents.spawned(event => {
    const entity = event.entity

    if (entity.type !== 'minecraft:item') return
    if (!entity.item || entity.item.id !== ENCHANTED_BOOK) return

    event.cancel()
})

// Remove imediatamente qualquer livro encantado que entre no inventário.
PlayerEvents.inventoryChanged(ENCHANTED_BOOK, event => {
    event.player.runCommandSilent(`clear @s ${ENCHANTED_BOOK}`)
})

// Limpa livros encantados antigos de jogadores ao entrarem no mundo.
PlayerEvents.loggedIn(event => {
    event.player.runCommandSilent(`clear @s ${ENCHANTED_BOOK}`)
})
