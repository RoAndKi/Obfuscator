const crypto = require('crypto');

const OP_VARS = {
    A: "2",
    B: "3",
    C: "4",
    BX: "5"
};

function randomStr(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let res = chars[Math.floor(Math.random() * chars.length)];
    const pool = chars + '0123456789';
    for (let i = 1; i < length; i++) {
        res += pool[Math.floor(Math.random() * pool.length)];
    }
    return res;
}

function shuffle(array) {
    let curr = array.length, rand;
    while (curr !== 0) {
        rand = Math.floor(Math.random() * curr);
        curr--;
        [array[curr], array[rand]] = [array[rand], array[curr]];
    }
    return array;
}

class VOpcode {
    constructor(name) {
        this.name = name;
        this.vIndex = 0;
    }
    getObfuscated() { return ""; }
}

class OpMove extends VOpcode {
    constructor() { super('MOVE'); }
    getObfuscated() { return `Stk[Inst[${OP_VARS.A}]] = Stk[Inst[${OP_VARS.B}]];`; }
}

class OpLoadK extends VOpcode {
    constructor() { super('LOADK'); }
    getObfuscated() { return `Stk[Inst[${OP_VARS.A}]] = Const[Inst[${OP_VARS.BX}]];`; }
}

class OpCall extends VOpcode {
    constructor() { super('CALL'); }
    getObfuscated() { return `local A=Inst[${OP_VARS.A}];local Args={};local Limit=A+Inst[${OP_VARS.B}]-1;for Idx=A+1,Limit do Args[#Args+1]=Stk[Idx];end;local Results={Stk[A](Unpack(Args,1,Limit-A))};local Edx=0;for Idx=A,A+Inst[${OP_VARS.C}]-2 do Edx=Edx+1;Stk[Idx]=Results[Edx];end;Top=A+Inst[${OP_VARS.C}]-2;`; }
}

class OpReturn extends VOpcode {
    constructor() { super('RETURN'); }
    getObfuscated() { return `local A=Inst[${OP_VARS.A}];local Output={};for Idx=A,A+Inst[${OP_VARS.B}]-2 do Output[#Output+1]=Stk[Idx];end;do return Unpack(Output) end;`; }
}

class OpGetGlobal extends VOpcode {
    constructor() { super('GETGLOBAL'); }
    getObfuscated() { return `Stk[Inst[${OP_VARS.A}]] = Env[Const[Inst[${OP_VARS.BX}]]];`; }
}

class OpAdd extends VOpcode {
    constructor() { super('ADD'); }
    getObfuscated() { return `Stk[Inst[${OP_VARS.A}]] = Stk[Inst[${OP_VARS.B}]] + Stk[Inst[${OP_VARS.C}]];`; }
}

class OpJmp extends VOpcode {
    constructor() { super('JMP'); }
    getObfuscated() { return `InstrPoint = InstrPoint + Inst[${OP_VARS.BX}];`; }
}

class OpEq extends VOpcode {
    constructor() { super('EQ'); }
    getObfuscated() { return `if(Stk[Inst[${OP_VARS.A}]] == Stk[Inst[${OP_VARS.C}]]) then InstrPoint = InstrPoint + 1; else InstrPoint = InstrPoint + Inst[${OP_VARS.B}]; end;`; }
}

function buildDispatchTree(opcodes) {
    if (opcodes.length === 1) {
        return opcodes[0].getObfuscated();
    }
    if (opcodes.length === 2) {
        return `if Enum == ${opcodes[0].vIndex} then ${opcodes[0].getObfuscated()} else ${opcodes[1].getObfuscated()} end;`;
    }

    const mid = Math.floor(opcodes.length / 2);
    const left = opcodes.slice(0, mid);
    const right = opcodes.slice(mid);
    const splitVal = left[left.length - 1].vIndex;

    return `if Enum <= ${splitVal} then ${buildDispatchTree(left)} else ${buildDispatchTree(right)} end;`;
}

function compressBytecode(source) {
    let xorKey = crypto.randomInt(1, 255);
    let bytes = [];
    for (let i = 0; i < source.length; i++) {
        bytes.push(source.charCodeAt(i) ^ xorKey);
    }
    return { data: bytes.join(','), key: xorKey };
}

function generateVM(sourceCode) {
    const xorPrimary = crypto.randomInt(100000, 999999);
    
    let opcodes = [
        new OpMove(), new OpLoadK(), new OpCall(), new OpReturn(),
        new OpGetGlobal(), new OpAdd(), new OpJmp(), new OpEq()
    ];
    
    opcodes = shuffle(opcodes);
    for (let i = 0; i < opcodes.length; i++) {
        opcodes[i].vIndex = i;
    }

    const dispatchCode = buildDispatchTree(opcodes);
    const bytecodePayload = compressBytecode(sourceCode);

    const vmP1 = `
local BitXOR = bit and bit.bxor or function(a,b)
    local p,c=1,0
    while a>0 and b>0 do
        local ra,rb=a%2,b%2
        if ra~=rb then c=c+p end
        a,b,p=(a-ra)/2,(b-rb)/2,p*2
    end
    if a<b then a=b end
    while a>0 do
        local ra=a%2
        if ra>0 then c=c+p end
        a,p=(a-ra)/2,p*2
    end
    return c
end

local ByteString = {${bytecodePayload.data}}
local XOR_KEY = ${bytecodePayload.key}

local function DecryptData()
    local res = {}
    for i=1, #ByteString do
        res[i] = string.char(BitXOR(ByteString[i], XOR_KEY))
    end
    return table.concat(res)
end

local function Deserialize()
    local Consts = {DecryptData()}
    local Instrs = {} 
    local Functions = {}
    return {Instrs, Consts, Functions, 0}
end
`;

    const vmP2 = `
local function Wrap(Chunk, Upvalues, Env)
    local Instr  = Chunk[1]
    local Const  = Chunk[2]
    local Proto  = Chunk[3]
    local Params = Chunk[4]

    return function(...)
        local _R = function(...) return {...}, select('#', ...) end
        local Unpack = unpack or table.unpack
        local InstrPoint = 1
        local Top = -1
        local Args = {...}
        local PCount = select('#', ...) - 1
        local Stk = {}

        for Idx = 0, PCount do
            Stk[Idx] = Args[Idx + 1]
        end

        local Inst
        local Enum

        local realExec = loadstring or load
        if realExec then
            local exec = realExec(Const[1])
            if exec then return exec(...) end
        end

        while true do
            Inst = Instr[InstrPoint]
            if not Inst then break end
            Enum = Inst[1]

            ${dispatchCode}

            InstrPoint = InstrPoint + 1
        end
    end
end
return Wrap(Deserialize(), {}, getfenv or function() return _ENV end)()
`;

    let finalVM = vmP1 + vmP2;
    const junkFunc = `local ${randomStr()} = function() local x = ${crypto.randomInt(1,99)} return x * 2 end;`;
    
    return junkFunc + "\n" + finalVM;
}

module.exports = { generateVM };
