var Comfort = Comfort || {};

// Hexadecimal conversion helper function
var hexChar = ["0", "1", "2", "3", "4", "5", "6", "7","8", "9", "A", "B", "C", "D", "E", "F"];
Comfort.bytes_to_hex = function(b) { 
    var op = ''; 
    for(var i = 0; i < b.length; i++) op += (hexChar[(b[i] >> 4) & 0x0f] + hexChar[b[i] & 0x0f]); 
    return op; 
};