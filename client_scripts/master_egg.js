// Master Egg tooltip
//
// Empty egg:   Empty
// Filled egg:  <mob name>

const $Component = Java.loadClass('net.minecraft.network.chat.Component')

ItemEvents.dynamicTooltips('kubejs:master_egg', event => {
    const data = event.item.getCustomData()

    if (data.contains('captured_name')) {
        event.add([$Component.literal(data.getString('captured_name'))])
    } else {
        event.add([$Component.literal('Empty')])
    }
})
