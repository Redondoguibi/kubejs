// Custom Trial Spawner - Minecraft 1.21.1 NeoForge / KubeJS 7.2
//
// The BlockEntity starts with a complete NBT schema so FTB Library's
// "nbtedit block" can edit every supported option without creating tags.
//
// Editable data lives under:
//   data.config
//
// Internal state lives under:
//   data.runtime

const $CompoundTag = Java.loadClass('net.minecraft.nbt.CompoundTag')

StartupEvents.registry('block', event => {
    const defaults = new $CompoundTag()

    const config = new $CompoundTag()
    config.putString('mob_id', 'minecraft:zombie')
    config.putBoolean('enabled', true)
    config.putDouble('detection_radius', 14.0)
    config.putInt('spawn_count', 1)
    config.putInt('max_alive', 1)
    config.putInt('spawn_delay_ticks', 20)
    config.putInt('cooldown_ticks', 100)
    config.putBoolean('require_players_to_leave', true)
    config.putBoolean('one_time', false)
    config.putBoolean('consume_spawn_egg', true)
    config.putBoolean('lock_spawn_egg', false)
    config.putDouble('spawn_offset_x', 0.5)
    config.putDouble('spawn_offset_y', 1.1)
    config.putDouble('spawn_offset_z', 0.5)

    // This compound is merged directly into every entity before it spawns.
    // These are safe, visible placeholders that can be edited or expanded
    // through FTB Library nbtedit.
    const mobNbt = new $CompoundTag()
    mobNbt.putBoolean('PersistenceRequired', true)
    mobNbt.putBoolean('Silent', false)
    mobNbt.putBoolean('NoAI', false)
    mobNbt.putBoolean('Invulnerable', false)
    mobNbt.putBoolean('Glowing', false)
    mobNbt.putBoolean('CustomNameVisible', false)
    config.put('mob_nbt', mobNbt)

    const runtime = new $CompoundTag()
    runtime.putBoolean('active', false)
    runtime.putBoolean('waiting_reset', false)
    runtime.putBoolean('completed_once', false)
    runtime.putInt('spawned_count', 0)
    runtime.putInt('alive_count', 0)
    runtime.putInt('cycle_id', 0)
    runtime.putLong('next_spawn_time', 0)
    runtime.putLong('cooldown_until', 0)

    defaults.put('config', config)
    defaults.put('runtime', runtime)

    event.create('stone_trial_spawner')
        .displayName('Stone Trial Spawner')
        .parentModel('kubejs:block/stone_spawner_model')
        .defaultCutout()
        .stoneSoundType()
        .unbreakable()
        .blockEntity(info => {
            info.initialData(defaults)
            info.serverTicking()
            // Runtime checks happen twice per second. Timing options still use
            // normal Minecraft ticks (20 ticks = 1 second).
            info.tickFrequency(10)
            info.enableSync()
        })
})
