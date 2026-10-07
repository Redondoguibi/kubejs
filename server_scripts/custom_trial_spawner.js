// Custom Trial Spawner - runtime logic
//
// Editable configuration is stored under BlockEntity data.config.
// Internal state is stored under data.runtime.
//
// This makes the full setup visible in:
//   /ftblibrary nbtedit block
//
// CONFIG FIELDS
// mob_id                    Entity ID to spawn.
// enabled                   Master on/off switch.
// detection_radius          Player activation radius in blocks.
// spawn_count               Total mobs spawned per encounter.
// max_alive                 Maximum simultaneous spawned mobs.
// spawn_delay_ticks         Delay between individual spawns.
// cooldown_ticks            Delay after the encounter before rearming.
// require_players_to_leave  If true, players must leave before another cycle.
// one_time                  If true, the spawner permanently stops after 1 win.
// consume_spawn_egg         Consume an egg when configuring by right-click.
// lock_spawn_egg            Prevent spawn eggs from changing mob_id.
// spawn_offset_x/y/z        Spawn position relative to block corner.
// mob_nbt                   NBT merged into every spawned entity.
//
// RUNTIME FIELDS are managed by this script and normally should not be edited.

const CUSTOM_TRIAL_SPAWNER = 'kubejs:stone_trial_spawner'

const $CompoundTag = Java.loadClass('net.minecraft.nbt.CompoundTag')
const $SpawnEggItem = Java.loadClass('net.minecraft.world.item.SpawnEggItem')
const $BuiltInRegistries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
const $ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
const $Mob = Java.loadClass('net.minecraft.world.entity.Mob')

function putDefaultBoolean(tag, key, value) {
    if (!tag.contains(key)) tag.putBoolean(key, value)
}

function putDefaultInt(tag, key, value) {
    if (!tag.contains(key)) tag.putInt(key, value)
}

function putDefaultLong(tag, key, value) {
    if (!tag.contains(key)) tag.putLong(key, value)
}

function putDefaultDouble(tag, key, value) {
    if (!tag.contains(key)) tag.putDouble(key, value)
}

function putDefaultString(tag, key, value) {
    if (!tag.contains(key)) tag.putString(key, value)
}

function createDefaultMobNbt() {
    const mobNbt = new $CompoundTag()
    mobNbt.putBoolean('PersistenceRequired', true)
    mobNbt.putBoolean('Silent', false)
    mobNbt.putBoolean('NoAI', false)
    mobNbt.putBoolean('Invulnerable', false)
    mobNbt.putBoolean('Glowing', false)
    mobNbt.putBoolean('CustomNameVisible', false)
    return mobNbt
}

// Ensures old blocks and partially edited blocks always have the full schema.
// It also migrates the first version of this spawner, which used flat tags.
function ensureSpawnerData(data) {
    let config
    if (data.contains('config')) {
        config = data.getCompound('config')
    } else {
        config = new $CompoundTag()

        const oldMobId = data.contains('mob_id') ? data.getString('mob_id') : ''
        config.putString('mob_id', oldMobId.length > 0 ? oldMobId : 'minecraft:zombie')
        data.put('config', config)
    }

    let runtime
    if (data.contains('runtime')) {
        runtime = data.getCompound('runtime')
    } else {
        runtime = new $CompoundTag()

        runtime.putBoolean('active', data.contains('active') && data.getBoolean('active'))
        runtime.putBoolean('waiting_reset', data.contains('waiting_reset') && data.getBoolean('waiting_reset'))
        data.put('runtime', runtime)
    }

    putDefaultString(config, 'mob_id', 'minecraft:zombie')
    putDefaultBoolean(config, 'enabled', true)
    putDefaultDouble(config, 'detection_radius', 14.0)
    putDefaultInt(config, 'spawn_count', 1)
    putDefaultInt(config, 'max_alive', 1)
    putDefaultInt(config, 'spawn_delay_ticks', 20)
    putDefaultInt(config, 'cooldown_ticks', 100)
    putDefaultBoolean(config, 'require_players_to_leave', true)
    putDefaultBoolean(config, 'one_time', false)
    putDefaultBoolean(config, 'consume_spawn_egg', true)
    putDefaultBoolean(config, 'lock_spawn_egg', false)
    putDefaultDouble(config, 'spawn_offset_x', 0.5)
    putDefaultDouble(config, 'spawn_offset_y', 1.1)
    putDefaultDouble(config, 'spawn_offset_z', 0.5)

    if (!config.contains('mob_nbt')) {
        config.put('mob_nbt', createDefaultMobNbt())
    }

    putDefaultBoolean(runtime, 'active', false)
    putDefaultBoolean(runtime, 'waiting_reset', false)
    putDefaultBoolean(runtime, 'completed_once', false)
    putDefaultInt(runtime, 'spawned_count', 0)
    putDefaultInt(runtime, 'alive_count', 0)
    putDefaultInt(runtime, 'cycle_id', 0)
    putDefaultLong(runtime, 'next_spawn_time', 0)
    putDefaultLong(runtime, 'cooldown_until', 0)

    data.remove('mob_id')
    data.remove('active')
    data.remove('waiting_reset')
    data.remove('mob_uuid')

    return { config: config, runtime: runtime }
}

function resetRuntimeForConfiguration(runtime) {
    runtime.putBoolean('active', false)
    runtime.putBoolean('waiting_reset', false)
    runtime.putBoolean('completed_once', false)
    runtime.putInt('spawned_count', 0)
    runtime.putInt('alive_count', 0)
    runtime.putLong('next_spawn_time', 0)
    runtime.putLong('cooldown_until', 0)
}

// Configure the spawner by right-clicking it with any SpawnEggItem.
BlockEvents.rightClicked(CUSTOM_TRIAL_SPAWNER, event => {
    const level = event.block.level
    if (level.isClientSide()) return

    const stack = event.item
    if (stack == null || stack.isEmpty()) return

    const item = stack.item
    if (!(item instanceof $SpawnEggItem)) return

    const blockEntity = event.block.entity
    if (blockEntity == null) return

    const parts = ensureSpawnerData(blockEntity.data)
    const config = parts.config
    const runtime = parts.runtime

    if (config.getBoolean('lock_spawn_egg')) {
        event.player.tell('Este Custom Trial Spawner está bloqueado para ovos de spawn.')
        event.cancel()
        return
    }

    if (runtime.getBoolean('active')) {
        event.player.tell('Derrote os mobs atuais antes de trocar o ovo deste spawner.')
        event.cancel()
        return
    }

    const entityType = item.getType(stack)
    const entityId = $BuiltInRegistries.ENTITY_TYPE.getKey(entityType)
    if (entityId == null) return

    config.putString('mob_id', entityId.toString())
    resetRuntimeForConfiguration(runtime)
    blockEntity.sync()

    if (config.getBoolean('consume_spawn_egg') && !event.player.getAbilities().instabuild) {
        stack.shrink(1)
    }

    event.player.tell('Custom Trial Spawner configurado para: ' + entityId)
    event.cancel()
})

// Main encounter state machine.
BlockEvents.blockEntityTick(CUSTOM_TRIAL_SPAWNER, event => {
    const level = event.level
    if (level.isClientSide()) return

    const block = event.block
    const blockEntity = block.entity
    if (blockEntity == null) return

    const parts = ensureSpawnerData(blockEntity.data)
    const config = parts.config
    const runtime = parts.runtime

    if (!config.getBoolean('enabled')) return

    const mobId = config.getString('mob_id')
    if (mobId.length === 0) return

    if (config.getBoolean('one_time') && runtime.getBoolean('completed_once')) return

    const detectionRadius = Math.max(0.0, config.getDouble('detection_radius'))
    const spawnCount = Math.max(1, config.getInt('spawn_count'))
    const maxAlive = Math.max(1, config.getInt('max_alive'))
    const spawnDelay = Math.max(0, config.getInt('spawn_delay_ticks'))
    const cooldown = Math.max(0, config.getInt('cooldown_ticks'))
    const gameTime = level.getGameTime()
    const nearbyPlayers = block.getPlayersInRadius(detectionRadius)

    if (runtime.getBoolean('waiting_reset')) {
        if (gameTime < runtime.getLong('cooldown_until')) return

        if (config.getBoolean('require_players_to_leave') && !nearbyPlayers.isEmpty()) {
            return
        }

        runtime.putBoolean('waiting_reset', false)
        runtime.putInt('spawned_count', 0)
        runtime.putInt('alive_count', 0)
        runtime.putLong('next_spawn_time', 0)
        runtime.putLong('cooldown_until', 0)
        blockEntity.sync()

        if (config.getBoolean('require_players_to_leave')) return
    }

    if (!runtime.getBoolean('active')) {
        if (nearbyPlayers.isEmpty()) return

        runtime.putBoolean('active', true)
        runtime.putInt('spawned_count', 0)
        runtime.putInt('alive_count', 0)
        runtime.putInt('cycle_id', runtime.getInt('cycle_id') + 1)
        runtime.putLong('next_spawn_time', gameTime)
        blockEntity.sync()
    }

    const spawnedCount = runtime.getInt('spawned_count')
    const aliveCount = runtime.getInt('alive_count')

    if (spawnedCount >= spawnCount || aliveCount >= maxAlive) return
    if (gameTime < runtime.getLong('next_spawn_time')) return

    const entityType = $BuiltInRegistries.ENTITY_TYPE.get($ResourceLocation.parse(mobId))
    if (entityType == null) return

    const mob = block.createEntity(entityType)
    if (mob == null) return

    mob.setPositionAndRotation(
        block.x + config.getDouble('spawn_offset_x'),
        block.y + config.getDouble('spawn_offset_y'),
        block.z + config.getDouble('spawn_offset_z'),
        level.random.nextFloat() * 360.0,
        0.0
    )

    const customMobNbt = config.getCompound('mob_nbt')
    if (!customMobNbt.isEmpty()) {
        mob.mergeNbt(customMobNbt)
    }

    if (mob instanceof $Mob) {
        mob.setPersistenceRequired()
    }

    const mobData = mob.persistentData
    mobData.putBoolean('custom_trial_spawner_mob', true)
    mobData.putInt('spawner_x', block.x)
    mobData.putInt('spawner_y', block.y)
    mobData.putInt('spawner_z', block.z)
    mobData.putString('spawner_dimension', block.dimension.toString())
    mobData.putInt('cycle_id', runtime.getInt('cycle_id'))

    if (!level.addFreshEntity(mob)) {
        runtime.putLong('next_spawn_time', gameTime + 20)
        blockEntity.sync()
        return
    }

    runtime.putInt('spawned_count', spawnedCount + 1)
    runtime.putInt('alive_count', aliveCount + 1)
    runtime.putLong('next_spawn_time', gameTime + spawnDelay)
    blockEntity.sync()
})

// Update encounter state whenever an owned mob dies.
EntityEvents.death(event => {
    const level = event.level
    if (level.isClientSide()) return

    const entity = event.entity
    const mobData = entity.persistentData

    if (!mobData.getBoolean('custom_trial_spawner_mob')) return
    if (mobData.getString('spawner_dimension') !== level.getDimension().toString()) return

    const x = mobData.getInt('spawner_x')
    const y = mobData.getInt('spawner_y')
    const z = mobData.getInt('spawner_z')

    const block = level.getBlock(x, y, z)
    if (block.id !== CUSTOM_TRIAL_SPAWNER) return

    const blockEntity = block.entity
    if (blockEntity == null) return

    const parts = ensureSpawnerData(blockEntity.data)
    const config = parts.config
    const runtime = parts.runtime

    if (mobData.getInt('cycle_id') !== runtime.getInt('cycle_id')) return

    const aliveAfterDeath = Math.max(0, runtime.getInt('alive_count') - 1)
    runtime.putInt('alive_count', aliveAfterDeath)

    const spawnCount = Math.max(1, config.getInt('spawn_count'))
    const allSpawned = runtime.getInt('spawned_count') >= spawnCount

    if (allSpawned && aliveAfterDeath === 0) {
        runtime.putBoolean('active', false)
        runtime.putBoolean('waiting_reset', true)
        runtime.putBoolean('completed_once', true)
        runtime.putLong(
            'cooldown_until',
            level.getGameTime() + Math.max(0, config.getInt('cooldown_ticks'))
        )
    }

    blockEntity.sync()
})
