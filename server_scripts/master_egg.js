// Master Egg - capture and spawn logic
//
// Minecraft 1.21.1 NeoForge / KubeJS 7.2
//
// Right-click a living mob to copy it.
// Right-click a block to spawn a copy.
//
// Everything is inside its own scope to avoid const redeclaration errors
// with other KubeJS server scripts.

(() => {
    const MASTER_EGG = 'kubejs:master_egg'

    const $LivingEntity = Java.loadClass(
        'net.minecraft.world.entity.LivingEntity'
    )

    const $Player = Java.loadClass(
        'net.minecraft.world.entity.player.Player'
    )

    const $BuiltInRegistries = Java.loadClass(
        'net.minecraft.core.registries.BuiltInRegistries'
    )

    const $ResourceLocation = Java.loadClass(
        'net.minecraft.resources.ResourceLocation'
    )

    // These tags should NOT be copied.
    // A fresh entity needs its own UUID, position and temporary state.
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


    // =========================================================
    // CAPTURE MOB
    // =========================================================

    ItemEvents.entityInteracted(MASTER_EGG, event => {
        const level = event.level

        if (level.isClientSide()) {
            return
        }

        const target = event.target

        // Only living entities.
        // Players can't be copied.
        if (!(target instanceof $LivingEntity)) {
            return
        }

        if (target instanceof $Player) {
            return
        }

        const stack = event.item

        const entityType = target.getEntityType()

        const entityId =
            $BuiltInRegistries.ENTITY_TYPE.getKey(entityType)

        if (entityId == null) {
            return
        }

        const data = stack.getCustomData()

        data.putString(
            'captured_type',
            entityId.toString()
        )

        data.putString(
            'captured_name',
            target.getName().getString()
        )

        data.put(
            'captured_nbt',
            makeSafeEntityNbt(target)
        )

        stack.setCustomData(data)

        // Enable enchantment glint after capturing.
        stack.setGlintOverride(true)

        // Prevent normal mob interaction from also occurring.
        event.cancel()
    })


    // =========================================================
    // SPAWN COPIED MOB
    // =========================================================

    BlockEvents.rightClicked(event => {
        const stack = event.item

        if (stack == null) {
            return
        }

        if (stack.isEmpty()) {
            return
        }

        if (stack.id !== MASTER_EGG) {
            return
        }

        const level = event.level

        if (level.isClientSide()) {
            return
        }

        const data = stack.getCustomData()

        if (!data.contains('captured_type')) {
            return
        }

        if (!data.contains('captured_nbt')) {
            return
        }

        const typeId = data.getString('captured_type')

        if (typeId.length === 0) {
            return
        }

        const resourceLocation =
            $ResourceLocation.parse(typeId)

        const entityType =
            $BuiltInRegistries.ENTITY_TYPE.get(resourceLocation)

        if (entityType == null) {
            return
        }


        // Spawn in the block adjacent to the clicked face.
        const spawnBlock =
            event.block.offset(event.facing)

        const entity =
            spawnBlock.createEntity(entityType)

        if (entity == null) {
            return
        }


        // Position the fresh entity first.
        entity.setPositionAndRotation(
            spawnBlock.centerX,
            spawnBlock.y,
            spawnBlock.centerZ,
            event.player.getYaw(),
            0.0
        )


        // Apply the captured NBT.
        //
        // UUID, Pos, Motion etc. were removed during capture,
        // so the new entity keeps its own fresh identity and position.
        const capturedNbt =
            data.getCompound('captured_nbt')

        entity.mergeNbt(capturedNbt)


        // Add entity to the world.
        if (!level.addFreshEntity(entity)) {
            return
        }


        // Egg remains reusable.
        event.cancel()
    })
})()