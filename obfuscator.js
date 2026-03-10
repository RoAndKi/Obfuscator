const crypto = require('crypto');

function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = chars.charAt(Math.floor(Math.random() * chars.length));
    const allChars = chars + '0123456789_';
    for (let i = 1; i < length; i++) {
        result += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    return result;
}

function generateJunkCode() {
    const junkVars = [generateRandomString(8), generateRandomString(10), generateRandomString(6)];
    return `local ${junkVars[0]} = ${Math.floor(Math.random() * 999999)}; local ${junkVars[1]} = function() return ${junkVars[0]} * 2 end; local ${junkVars[2]} = ${junkVars[1]}();`;
}

function obfuscateScript(sourceCode) {
    const shiftKey = Math.floor(Math.random() * 10) + 1;
    
    let encodedData = [];
    for (let i = 0; i < sourceCode.length; i++) {
        encodedData.push(sourceCode.charCodeAt(i) + shiftKey);
    }
    
    const bytecodeString = encodedData.join(',');

    const vmStrEnv = generateRandomString(12);
    const vmStrBytecode = generateRandomString(10);
    const vmStrDecoder = generateRandomString(14);
    const vmStrBuffer = generateRandomString(8);
    const vmStrChar = generateRandomString(6);
    const vmStrLoad = generateRandomString(9);

    const junk1 = generateJunkCode();
    const junk2 = generateJunkCode();
    const junk3 = generateJunkCode();

    const luaVM = `
${junk1}
local ${vmStrEnv} = getfenv or function() return _ENV end
local ${vmStrBytecode} = {${bytecodeString}}
${junk2}
local ${vmStrChar} = string.char
local ${vmStrLoad} = loadstring or load
local ${vmStrBuffer} = ""
local ${vmStrDecoder} = function(tbl, key)
    local res = ""
    for i = 1, #tbl do
        res = res .. ${vmStrChar}(tbl[i] - key)
    end
    return res
end
${junk3}
${vmStrBuffer} = ${vmStrDecoder}(${vmStrBytecode}, ${shiftKey})
local exec = ${vmStrLoad}(${vmStrBuffer})
if exec then
    return exec()
else
    error("VM Execution Failed")
end
`;

    const finalVars = new Map();
    let finalCode = luaVM;
    
    const wordsToReplace = [vmStrEnv, vmStrBytecode, vmStrDecoder, vmStrBuffer, vmStrChar, vmStrLoad, "exec", "res", "tbl", "key", "shiftKey"];
    
    wordsToReplace.forEach(word => {
        const replacement = "IllIIllIIll" + crypto.randomBytes(3).toString('hex');
        finalCode = finalCode.replace(new RegExp(`\\b${word}\\b`, 'g'), replacement);
    });

    return finalCode;
}

module.exports = { obfuscateScript };
