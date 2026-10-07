// Custom Trial Spawner - Minecraft 1.21.1 NeoForge / KubeJS 7.2
//
// Registers a completely separate block from minecraft:trial_spawner.
// Because it is not a vanilla Trial Spawner, Trial Omen / ominous logic does
// not upgrade or otherwise affect it.
//
// Texture:
//   assets/kubejs/textures/block/custom_trial_spawner.png

const $CompoundTag = Java.loadClass('net.minecraft.nbt.CompoundTag')

StartupEvents.registry('block', event => {
    const defaults = new $CompoundTag()
    defaults.putString('mob_id', '')
    defaults.putBoolean('active', false)
    defaults.putBoolean('waiting_reset', false)
    defaults.putString('mob_uuid', '')

    event.create('custom_trial_spawner')
        .displayName('Custom Trial Spawner')
        .textureAll('kubejs:block/custom_trial_spawner')
        .stoneSoundType()
        .hardness(5.0)
        .resistance(1200.0)
        .requiresTool()
        .tagBlock('minecraft:mineable/pickaxe')
        .tagBlock('minecraft:needs_iron_tool')
        .blockEntity(info => {
            info.initialData(defaults)
            info.serverTicking()
            // Check the spawner twice per second. This is plenty for player
            // detection without running the logic every game tick.
            info.tickFrequency(10)
            info.enableSync()
        })
})
