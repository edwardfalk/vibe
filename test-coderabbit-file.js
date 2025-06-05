
// Test file for CodeRabbit comment verification
function testFunction() {
    var x = 1; // Should suggest const/let
    console.log("Missing emoji prefix"); // Should suggest emoji
    if (x == 1) { // Should suggest ===
        return true;
    }
    // Missing return statement for else case
}

class TestEnemy {
    constructor(x, y) { // Missing required parameters
        this.x = x;
        this.y = y;
    }
    
    update() { // Missing deltaTimeMs parameter
        this.x += 1; // Frame-dependent movement
    }
}
