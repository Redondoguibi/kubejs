// Minecraft 1.21.1 - NeoForge - KubeJS 7.x
//
// Remove encantamentos de todas as tags de encantamento.
// Isso desativa as formas normais de obtenção baseadas em tags,
// como mesa de encantamentos, loot aleatório e trocas.
//
// Uso:
// disableEnchantment('minecraft:mending')
// disableEnchantment('minecraft:sharpness')
// disableEnchantment('modid:enchantment_id')

ServerEvents.tags('enchantment', event => {

    function disableEnchantment(enchantmentId) {
        event.removeAllTagsFrom(enchantmentId)
    }

    // ============================================================
    // ENCANTAMENTOS DESATIVADOS
    // Adicione quantas chamadas quiser abaixo:
    // ============================================================

    // disableEnchantment('minecraft:mending')
    // disableEnchantment('minecraft:sharpness')
    // disableEnchantment('minecraft:unbreaking')

})
