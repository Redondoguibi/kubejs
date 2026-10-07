// Master Egg - capture and spawn logic
//
// This file is intentionally isolated in its own function scope.
// KubeJS server_scripts share a global scope, so top-level const declarations
// can otherwise collide with classes/constants declared by other scripts.

(() => {
    // Master Egg - capture and spawn logic
    //
    // Right-click a living non-player entity to copy it.
    // Right-click a block to spawn a copy on the adjacent block space.
    //
    // The original entity is NOT removed.
    // The captured template remains in the egg after spawning.
    
    const MASTER_EGG = 'kubejs:master_egg'
    
    const $LivingEntity = Java.loadClass('net.minecraft.world.entity.LivingEntity')
    const $Player = Java.loadClass('net.minecraft.world.entity.player.Player')
    const $BuiltInRegistries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
    const $ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
    
    // Tags that must not be copied from the source entity.
    // Identity and position are generated fresh for every spawned copy.
    const TRANSIENT_ENTITY_TAGS = [
        'UUID',
        'Pos',
        'Motion',
        'Rotation',
        'FallDistance',
        'PortalCooldown',
        'Passengers',
        'Leash',
        'DeathTime',
        'HurtTime',
        'HurtByTimestamp',
        'SleepingX',
        'SleepingY',
        'SleepingZ'
    ]
    
    function makeSafeEntityNbt(entity) {
        const nbt = entity.getNbt()
    
        for (const key of TRANSIENT_ENTITY_TAGS) {
            nbt.remove(key)
        }
    
        return nbt
    }
    
    // Copy a mob into the Master Egg.
    ItemEvents.entityInteracted(MASTER_EGG, event => {
        const level = event.level
        if (level.isClientSide()) return
    
        const target = event.target
    
        // "Mob" behavior: living entities are supported, players are not.
        if (!(target instanceof $LivingEntity) || target instanceof $Player) return
    
        const stack = event.item
        const entityType = target.getEntityType()
        const entityId = $BuiltInRegistries.ENTITY_TYPE.getKey(entityType)
        if (entityId == null) return
    
        const data = stack.getCustomData()
        data.putString('captured_type', entityId.toString())
        data.putString('captured_name', target.getName().getString())
        data.put('captured_nbt', makeSafeEntityNbt(target))
    
        stack.setCustomData(data)
        stack.setGlintOverride(true)
    
        // Prevent the target's normal right-click interaction from also firing.
        event.cancel()
    })
    
    // Spawn the copied entity by right-clicking a block with the Master Egg.
    BlockEvents.rightClicked(event => {
        const stack = event.item
        if (stack == null || stack.isEmpty() || stack.id !== MASTER_EGG) return

        // The Stone Trial Spawner has its own Master Egg handler. Do not spawn
        // the copied mob next to it when the player is trying to configure it.
        if (event.block.id === 'kubejs:stone_trial_spawner') return
    
        const level = event.level
        if (level.isClientSide()) return
    
        const data = stack.getCustomData()
        const typeId = data.getString('captured_type')
    
        // Empty Master Eggs simply do nothing.
        if (typeId.length === 0 || !data.contains('captured_nbt')) return
    
        const entityType = $BuiltInRegistries.ENTITY_TYPE.get($ResourceLocation.parse(typeId))
        if (entityType == null) return
    
        // Spawn in the block space adjacent to the clicked face.
        const spawnBlock = event.block.offset(event.facing)
        const entity = spawnBlock.createEntity(entityType)
        if (entity == null) return
    
        entity.setPositionAndRotation(
            spawnBlock.centerX,
            spawnBlock.y,
            spawnBlock.centerZ,
            event.player.getYaw(),
            0.0
        )
    
        // mergeNbt starts from the newly-created entity's own full NBT, so the
        // fresh UUID/position remain intact because those keys were filtered out.
        entity.mergeNbt(data.getCompound('captured_nbt'))
    
        if (!level.addFreshEntity(entity)) return
    
        // Keep the egg reusable and keep its glint/template.
        event.cancel()
    })
    
})()
