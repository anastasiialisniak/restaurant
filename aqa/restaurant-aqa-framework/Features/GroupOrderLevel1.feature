@l1
Feature: Owner reviews group pre-order participants
  The Owner can review every guest cart, the participant totals and the group total.

  @ui
  @known-defect
  Scenario: Owner reviews guests with dishes and an empty unsubmitted cart
    Given the Owner has a group order with these guest carts:
      | name | quantity |
      | Mira | 2        |
      | Noah | 0        |
    When the Owner opens the group review
    Then all prepared guests, dishes, quantities and individual totals are displayed
    And the group total equals the sum of participant totals

  @ui
  @known-defect
  Scenario: Owner sees the group total change after a guest changes their cart
    Given the Owner has a group order with these guest carts:
      | name | quantity |
      | Ira  | 1        |
    When the Owner opens the group review
    And a guest adds one more portion and the Owner refreshes the group review
    Then the group total reflects the changed guest cart

  @ui
  Scenario: Owner sees an empty group as an empty participant list with zero total
    Given the Owner has a group order with no guests
    When the Owner opens the group review
    Then the group review has no participants and a total of zero

  @api
  @negative
  Scenario Outline: Only the Owner can read the group participant list
    Given the Owner has a group order with these guest carts:
      | name | quantity |
      | Remy | 0        |
    When the "<persona>" requests the participant list
    Then access is denied with the expected authorization response

    Examples:
      | persona                  |
      | another customer         |
      | guest                    |
      | waiter                   |
      | unauthenticated visitor  |

  @api
  @negative
  Scenario: Owner receives not found for a nonexistent group
    Given the Owner has a group order with no guests
    When the Owner requests a nonexistent group's participant list
    Then the group is reported as not found
