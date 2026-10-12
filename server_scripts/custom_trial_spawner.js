// Stone Trial Spawner - Minecraft 1.21.1 NeoForge / KubeJS 7.2
// Config editável: data.config
// Estado interno: data.runtime

(() => {
    const SPAWNER = 'kubejs:stone_trial_spawner'
    const MASTER_EGG = 'kubejs:master_egg'

    const $CompoundTag = Java.loadClass('net.minecraft.nbt.CompoundTag')
    const $SpawnEggItem = Java.loadClass('net.minecraft.world.item.SpawnEggItem')
    const $BuiltInRegistries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
    const $ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
    const $Mob = Java.loadClass('net.minecraft.world.entity.Mob')

    function defBool(tag, key, value) {
        if (!tag.contains(key)) tag.putBoolean(key, value)
    }

    function defInt(tag, key, value) {
        if (!tag.contains(key)) tag.putInt(key, value)
    }

    function defLong(tag, key, value) {
        if (!tag.contains(key)) tag.putLong(key, value)
    }

    function defDouble(tag, key, value) {
        if (!tag.contains(key)) tag.putDouble(key, value)
    }

    function defString(tag, key, value) {
        if (!tag.contains(key)) tag.putString(key, value)
    }

    function createDefaultMobNbt() {
        const nbt = new $CompoundTag()
        nbt.putBoolean('PersistenceRequired', true)
        nbt.putBoolean('Silent', false)
        nbt.putBoolean('NoAI', false)
        nbt.putBoolean('Invulnerable', false)
        nbt.putBoolean('Glowing', false)
        nbt.putBoolean('CustomNameVisible', false)
        return nbt
    }

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

        defString(config, 'mob_id', 'minecraft:zombie')
        defBool(config, 'enabled', true)
        defDouble(config, 'detection_radius', 14.0)

        defInt(config, 'spawn_count', 1)
        defInt(config, 'max_alive', 1)
        defInt(config, 'spawn_delay_ticks', 20)
        defInt(config, 'cooldown_ticks', 100)

        defBool(config, 'require_players_to_leave', true)
        defBool(config, 'one_time', false)
        defBool(config, 'consume_spawn_egg', true)
        defBool(config, 'lock_spawn_egg', false)

        defDouble(config, 'spawn_offset_x', 0.5)
        defDouble(config, 'spawn_offset_y', 1.1)
        defDouble(config, 'spawn_offset_z', 0.5)

        if (!config.contains('mob_nbt')) {
            config.put('mob_nbt', createDefaultMobNbt())
        }

        defBool(runtime, 'active', false)
        defBool(runtime, 'waiting_reset', false)
        defBool(runtime, 'completed_once', false)

        defInt(runtime, 'spawned_count', 0)
        defInt(runtime, 'alive_count', 0)
        defInt(runtime, 'cycle_id', 0)

        defLong(runtime, 'next_spawn_time', 0)
        defLong(runtime, 'cooldown_until', 0)

        data.remove('mob_id')
        data.remove('active')
        data.remove('waiting_reset')
        data.remove('mob_uuid')

        return { config: config, runtime: runtime }
    }

    function resetRuntime(runtime) {
        runtime.putBoolean('active', false)
        runtime.putBoolean('waiting_reset', false)
        runtime.putBoolean('completed_once', false)
        runtime.putInt('spawned_count', 0)
        runtime.putInt('alive_count', 0)
        runtime.putLong('next_spawn_time', 0)
        runtime.putLong('cooldown_until', 0)
    }

    // =========================================================
    // CONFIGURAR COM SPAWN EGG / MASTER EGG
    // =========================================================

    BlockEvents.rightClicked(SPAWNER, event => {
        const level = event.block.level
        if (level.isClientSide()) return

        const stack = event.item
        if (stack == null || stack.isEmpty()) return

        const item = stack.item
        const normalEgg = item instanceof $SpawnEggItem
        const masterEgg = stack.id === MASTER_EGG

        if (!normalEgg && !masterEgg) return

        const blockEntity = event.block.entity
        if (blockEntity == null) return

        const parts = ensureSpawnerData(blockEntity.data)
        const config = parts.config
        const runtime = parts.runtime

        if (config.getBoolean('lock_spawn_egg')) {
            event.player.tell('Este Stone Trial Spawner está bloqueado para configuração por ovos.')
            event.cancel()
            return
        }

        if (runtime.getBoolean('active')) {
            event.player.tell('Derrote os mobs atuais antes de trocar o mob deste spawner.')
            event.cancel()
            return
        }

        // Master Egg
        if (masterEgg) {
            const masterData = stack.getCustomData()

            if (!masterData.contains('captured_type') || !masterData.contains('captured_nbt')) {
                event.player.tell('Este Master Egg está vazio.')
                event.cancel()
                return
            }

            const capturedType = masterData.getString('captured_type')

            if (capturedType.length === 0) {
                event.player.tell('Este Master Egg está vazio.')
                event.cancel()
                return
            }

            config.putString('mob_id', capturedType)
            config.put('mob_nbt', masterData.getCompound('captured_nbt').copy())

            resetRuntime(runtime)
            blockEntity.sync()

            const name = masterData.contains('captured_name')
                ? masterData.getString('captured_name')
                : capturedType

            event.player.tell('Stone Trial Spawner configurado para: ' + name)
            event.cancel()
            return
        }

        // Spawn Egg normal
        const entityType = item.getType(stack)
        const entityId = $BuiltInRegistries.ENTITY_TYPE.getKey(entityType)

        if (entityId == null) return

        config.putString('mob_id', entityId.toString())
        config.put('mob_nbt', createDefaultMobNbt())

        resetRuntime(runtime)
        blockEntity.sync()

        if (config.getBoolean('consume_spawn_egg') && !event.player.getAbilities().instabuild) {
            stack.shrink(1)
        }

        event.player.tell('Stone Trial Spawner configurado para: ' + entityId)
        event.cancel()
    })

    // =========================================================
    // TICK DO SPAWNER
    // =========================================================

    BlockEvents.blockEntityTick(SPAWNER, event => {
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

        if (config.getBoolean('one_time') && runtime.getBoolean('completed_once')) {
            return
        }

        const radius = Math.max(0, config.getDouble('detection_radius'))
        const spawnCount = Math.max(1, config.getInt('spawn_count'))
        const maxAlive = Math.max(1, config.getInt('max_alive'))
        const spawnDelay = Math.max(0, config.getInt('spawn_delay_ticks'))
        const gameTime = level.getGameTime()

        const players = block.getPlayersInRadius(radius)

        // Esperando reset
        if (runtime.getBoolean('waiting_reset')) {
            if (gameTime < runtime.getLong('cooldown_until')) return

            if (config.getBoolean('require_players_to_leave') && !players.isEmpty()) {
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

        // Iniciar encontro
        if (!runtime.getBoolean('active')) {
            if (players.isEmpty()) return

            runtime.putBoolean('active', true)
            runtime.putInt('spawned_count', 0)
            runtime.putInt('alive_count', 0)
            runtime.putInt('cycle_id', runtime.getInt('cycle_id') + 1)
            runtime.putLong('next_spawn_time', gameTime)

            blockEntity.sync()
        }

        const spawned = runtime.getInt('spawned_count')
        const alive = runtime.getInt('alive_count')

        if (spawned >= spawnCount) return
        if (alive >= maxAlive) return
        if (gameTime < runtime.getLong('next_spawn_time')) return

        const entityType = $BuiltInRegistries.ENTITY_TYPE.get(
            $ResourceLocation.parse(mobId)
        )

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

        const mobNbt = config.getCompound('mob_nbt')

        if (!mobNbt.isEmpty()) {
            mob.mergeNbt(mobNbt)
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

        runtime.putInt('spawned_count', spawned + 1)
        runtime.putInt('alive_count', alive + 1)
        runtime.putLong('next_spawn_time', gameTime + spawnDelay)

        blockEntity.sync()
    })

    // =========================================================
    // MORTE DOS MOBS
    // =========================================================

    EntityEvents.death(event => {
        const level = event.level
        if (level.isClientSide()) return

        const entity = event.entity
        const mobData = entity.persistentData

        if (!mobData.getBoolean('custom_trial_spawner_mob')) return

        if (mobData.getString('spawner_dimension') !== level.getDimension().toString()) {
            return
        }

        const x = mobData.getInt('spawner_x')
        const y = mobData.getInt('spawner_y')
        const z = mobData.getInt('spawner_z')

        const block = level.getBlock(x, y, z)

        if (block.id !== SPAWNER) return

        const blockEntity = block.entity
        if (blockEntity == null) return

        const parts = ensureSpawnerData(blockEntity.data)
        const config = parts.config
        const runtime = parts.runtime

        if (mobData.getInt('cycle_id') !== runtime.getInt('cycle_id')) {
            return
        }

        const alive = Math.max(
            0,
            runtime.getInt('alive_count') - 1
        )

        runtime.putInt('alive_count', alive)

        const spawnCount = Math.max(
            1,
            config.getInt('spawn_count')
        )

        const allSpawned =
            runtime.getInt('spawned_count') >= spawnCount

        if (allSpawned && alive === 0) {
            runtime.putBoolean('active', false)
            runtime.putBoolean('waiting_reset', true)
            runtime.putBoolean('completed_once', true)

            runtime.putLong(
                'cooldown_until',
                level.getGameTime() +
                Math.max(0, config.getInt('cooldown_ticks'))
            )
        }

        blockEntity.sync()
    })
})()