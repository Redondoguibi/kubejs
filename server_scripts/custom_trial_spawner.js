// Custom Trial Spawner - runtime logic
//
// Behaviour:
// - Right-click with any SpawnEggItem (vanilla or modded) to configure the mob.
// - The egg is consumed, just like configuring a vanilla spawner.
// - When a real player enters the detection radius, exactly one configured mob
//   is spawned.
// - The spawned mob is persistent and will not naturally despawn.
// - After that mob dies, the spawner waits until every player leaves the
//   detection radius. It then becomes ready for the next encounter.
// - This block has no ominous/Trial Omen logic and no redstone output.

const CUSTOM_TRIAL_SPAWNER = 'kubejs:custom_trial_spawner'
const DETECTION_RADIUS = 14

const $SpawnEggItem = Java.loadClass('net.minecraft.world.item.SpawnEggItem')
const $BuiltInRegistries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
const $ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
const $Mob = Java.loadClass('net.minecraft.world.entity.Mob')

// Configure the spawner by right-clicking it with a spawn egg.
BlockEvents.rightClicked(CUSTOM_TRIAL_SPAWNER, event => {
    const level = event.block.level
    if (level.isClientSide()) return

    const stack = event.item
    if (stack == null || stack.isEmpty()) return

    const item = stack.item
    if (!(item instanceof $SpawnEggItem)) return

    const blockEntity = event.block.entity
    if (blockEntity == null) return

    const data = blockEntity.data

    // Don't let the target change in the middle of an active encounter.
    if (data.getBoolean('active')) {
        event.player.tell('Derrote o mob atual antes de trocar o ovo deste spawner.')
        event.cancel()
        return
    }

    const entityType = item.getType(stack)
    const entityId = $BuiltInRegistries.ENTITY_TYPE.getKey(entityType)
    if (entityId == null) return

    data.putString('mob_id', entityId.toString())
    data.putBoolean('active', false)
    data.putBoolean('waiting_reset', false)
    data.putString('mob_uuid', '')
    blockEntity.sync()

    if (!event.player.getAbilities().instabuild) {
        stack.shrink(1)
    }

    event.player.tell('Custom Trial Spawner configurado para: ' + entityId)
    event.cancel()
})

// Detect players and start encounters.
BlockEvents.blockEntityTick(CUSTOM_TRIAL_SPAWNER, event => {
    const level = event.level
    if (level.isClientSide()) return

    const block = event.block
    const blockEntity = block.entity
    if (blockEntity == null) return

    const data = blockEntity.data
    const mobId = data.getString('mob_id')

    // An unconfigured spawner does nothing.
    if (mobId.length === 0) return

    // While the spawned mob is alive, no additional mobs are created.
    if (data.getBoolean('active')) return

    const nearbyPlayers = block.getPlayersInRadius(DETECTION_RADIUS)

    // After a completed encounter, require all players to leave the activation
    // radius before the spawner can trigger again.
    if (data.getBoolean('waiting_reset')) {
        if (nearbyPlayers.isEmpty()) {
            data.putBoolean('waiting_reset', false)
            blockEntity.sync()
        }
        return
    }

    if (nearbyPlayers.isEmpty()) return

    const entityType = $BuiltInRegistries.ENTITY_TYPE.get($ResourceLocation.parse(mobId))
    if (entityType == null) return

    const mob = block.createEntity(entityType)
    if (mob == null) return

    // Spawn directly above the block.
    mob.setPositionAndRotation(
        block.centerX,
        block.y + 1.1,
        block.centerZ,
        level.random.nextFloat() * 360.0,
        0.0
    )

    // Trial-style encounter mobs should not naturally disappear.
    if (mob instanceof $Mob) {
        mob.setPersistenceRequired()
    }

    // Store which spawner owns this mob. Entity persistentData survives saves.
    const mobData = mob.persistentData
    mobData.putBoolean('custom_trial_spawner_mob', true)
    mobData.putInt('spawner_x', block.x)
    mobData.putInt('spawner_y', block.y)
    mobData.putInt('spawner_z', block.z)
    mobData.putString('spawner_dimension', block.dimension.toString())

    if (!level.addFreshEntity(mob)) return

    data.putBoolean('active', true)
    data.putString('mob_uuid', mob.getStringUuid())
    blockEntity.sync()
})

// Mark the encounter as complete when the mob spawned by this block dies.
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

    const data = blockEntity.data

    // Ignore a stale mob from an older/reconfigured encounter.
    const trackedUuid = data.getString('mob_uuid')
    if (trackedUuid.length > 0 && trackedUuid !== entity.getStringUuid()) return

    data.putBoolean('active', false)
    data.putBoolean('waiting_reset', true)
    data.putString('mob_uuid', '')
    blockEntity.sync()
})
