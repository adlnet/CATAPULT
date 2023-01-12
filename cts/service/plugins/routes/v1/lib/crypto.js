/**
 * Encrypt XOR method
 * @param {string} plainString - Plain text data to be encoded
 * @param {string} key - Crypt key used to XOR plainString
 * @returns {string} Cypher text
 */
const encrypt = (plainString, key) => {
    let cypher = '';

    for (let i = 0; i < plainString.length; i++) {

        // Find ascii code from key to be "xor"
        const keyPointer = i % key.length;

        // Convert char to int ASCII and "xor crypt" with int ASCII
        const dec = parseInt(((plainString[i]).charCodeAt(0) ^ (key[keyPointer]).charCodeAt(0)));

        // HEX convert + '0' Padding
        const hex = ('00' + dec.toString(16)).slice(-2);

        // Append to cypher string
        cypher += hex;
    }

    return cypher;
};

/**
 * Decrypt XOR method
 * @param {string} cypherString - Cypher string to be decoded
 * @param {string} key - Crypt key used to XOR cypherString
 * @returns {string} Plain text
 */
const decrypt = (cypherString, key) => {

    let plainText = '';
    const cypherArray = [];
    let i;
    // Group cypher by 2 hex char (16bits) into array
    for (i = 0; i < cypherString.length; i = i + 2) {
        cypherArray.push(cypherString[i] + cypherString[i + 1]);
    }

    // XOR Decrypt with provided cypher text and key
    for (i = 0; i < cypherArray.length; i++) {
        const hex = cypherArray[i];
        const dec = parseInt(hex, 16);
        const keyPointer = i % key.length;
        const asciiCode = dec ^ (key[keyPointer]).charCodeAt(0);
        plainText += String.fromCharCode(asciiCode);
    }
    return plainText;
};

module.exports = {
    encrypt,
    decrypt
};
