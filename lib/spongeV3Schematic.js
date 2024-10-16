const { Vec3 } = require('vec3')
const versions = require('minecraft-data').versions.pc
const { parseBlockName, getStateId } = require('./states')
const {Schematic} = require("../index");
const v = require("vec3");
const {cpuUsage} = require("process");

function findVersion (dataVersion) {
    for (const v of versions) {
        if (v.dataVersion === dataVersion) {
            return v.minecraftVersion
        }
    }
    return versions[0].minecraftVersion // default to latest
}

function getDataVersion (mcVersion) {
    for (const v of versions) {
        if (v.minecraftVersion === mcVersion) {
            return v.dataVersion
        }
    }
    return versions[0].dataVersion
}

function parsePalette (mcData, palette) {
    const out = []
    for (const [str, id] of Object.entries(palette)) {
        const { name, properties } = parseBlockName(str)
        out[id] = getStateId(mcData, name, properties)
    }
    return out
}

function writeBlockName (block) {
    const prop = []
    for (const [key, value] of Object.entries(block.getProperties())) {
        prop.push(`${key}=${value}`)
    }
    return `minecraft:${block.name}` + (prop.length > 0 ? `[${prop.join(',')}]` : '')
}

function writePalette (Block, palette) {
    const out = {}
    for (let id = 0; id < palette.length; id++) {
        const name = writeBlockName(Block.fromStateId(palette[id]))
        out[name] = { type: 'int', value: id }
    }
    return out
}

function byteArrayToVarintArray (byteArray) {
    const varintArray = []
    let i = 0
    while (i < byteArray.length) {
        let value = 0
        let varintLength = 0
        while (true) {
            value |= (byteArray[i] & 127) << (varintLength++ * 7)
            if (varintLength > 5) throw new Error('VarInt too big (probably corrupted data)')
            if ((byteArray[i++] & 128) !== 128) break
        }
        varintArray.push(value)
    }
    return varintArray
}

function varintArrayToByteArray (varintArray) {
    const byteArray = []
    for (let id of varintArray) {
        while ((id & -128) !== 0) {
            byteArray.push((id | 128) << 24 >> 24)
            id >>>= 7
        }
        byteArray.push(id << 24 >> 24)
    }
    return byteArray
}

function read (nbt, version) {
    const { Schematic } = require('../')
    if (!version) {
        version = findVersion(nbt.Schematic.DataVersion)
    }
    let mcData = require('minecraft-data')(version)
    if(!mcData){
        version = "1.20.6"
        console.log(`Warning, ${version} is not supported, using 1.20.6 as fallback`)
        mcData = require('minecraft-data')(version)
    }
    const palette = parsePalette(mcData, nbt.Schematic.Blocks.Palette)
    const size = new Vec3(nbt.Schematic.Width, nbt.Schematic.Height, nbt.Schematic.Length)
    let offset = new Vec3(0, 0, 0);

    if(nbt.Schematic.Offset){
        offset = new Vec3(
            nbt.Schematic.Offset[0],
            nbt.Schematic.Offset[1],
            nbt.Schematic.Offset[2])
    }
    const blocks = byteArrayToVarintArray(nbt.Schematic.Blocks.Data)
    const schem =  new Schematic(version, size, offset, palette, blocks)
    return schem;
}

//TODO also update for spongeV3
module.exports = { read }
