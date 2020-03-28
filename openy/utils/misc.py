"""General use functions"""

import random


def weighted_choice(population, weights):
    """Randomly choose an element from a population, according to a given
       probability distribution.
    """
    weight_sum = sum(weights)
    choice = random.random()
    for i, element in enumerate(population):
        if sum(weights[:i + 1]) / weight_sum >= choice:
            return element
    return None
