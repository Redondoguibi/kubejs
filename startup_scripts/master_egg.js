// Master Egg - Minecraft 1.21.1 NeoForge / KubeJS 7.2
//
// Reusable entity-copy egg.
// Runtime data is stored in the item's minecraft:custom_data component.

StartupEvents.registry('item', event => {
    event.create('master_egg')
        .displayName('Master Egg')
        .unstackable()
        .texture('minecraft:item/egg')
})
