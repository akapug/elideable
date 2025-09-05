
package core

import java.math.BigDecimal
import java.math.RoundingMode

fun calculateResult(a: Double, b: Double, operation: String): Double {
    val numA = BigDecimal(a)
    val numB = BigDecimal(b)
    
    return when (operation) {
        "+" -> numA.add(numB)
        "-" -> numA.subtract(numB)
        "*" -> numA.multiply(numB)
        "/" -> if (numB != BigDecimal.ZERO) {
            numA.divide(numB, 10, RoundingMode.HALF_UP)
        } else {
            throw IllegalArgumentException("Division by zero")
        }
        else -> throw IllegalArgumentException("Unknown operation")
    }.toDouble()
}
