// Twenty-eight dinners, the rotation a private chef would actually cook.

export interface MealSeed {
  title: string;
  cuisine: string;
  tags: string[];
}

export const MEALS: MealSeed[] = [
  { title: "Harissa roast chicken, charred lemon, couscous", cuisine: "North African", tags: ["weeknight", "kids love it"] },
  { title: "Miso glazed salmon, bok choy, sticky rice", cuisine: "Japanese", tags: ["weeknight", "light"] },
  { title: "Braised short ribs, parsnip mash, gremolata", cuisine: "American", tags: ["make-ahead", "sunday"] },
  { title: "Chickpea and spinach curry, basmati, raita", cuisine: "Indian", tags: ["veg", "make-ahead"] },
  { title: "Pork and ginger dumplings, cucumber salad", cuisine: "Chinese", tags: ["kids love it", "freezer friendly"] },
  { title: "Rigatoni with slow tomato and basil, burrata", cuisine: "Italian", tags: ["veg", "weeknight", "kids love it"] },
  { title: "Lemongrass chicken thighs, herb salad, jasmine rice", cuisine: "Vietnamese", tags: ["weeknight", "light"] },
  { title: "Shakshuka with feta, warm pita", cuisine: "Middle Eastern", tags: ["veg", "quick"] },
  { title: "Roasted cauliflower tacos, lime crema, pickled onion", cuisine: "Mexican", tags: ["veg", "kids love it"] },
  { title: "Beef bulgogi bowls, kimchi, sesame greens", cuisine: "Korean", tags: ["weeknight", "make-ahead"] },
  { title: "Chicken and leek pot pie, flaky top", cuisine: "British", tags: ["make-ahead", "kids love it", "freezer friendly"] },
  { title: "Mushroom and barley risotto, parmesan crisp", cuisine: "Italian", tags: ["veg", "cozy"] },
  { title: "Thai green curry with eggplant and tofu", cuisine: "Thai", tags: ["veg", "weeknight"] },
  { title: "Seared cod, white beans, salsa verde", cuisine: "Mediterranean", tags: ["light", "quick"] },
  { title: "Lamb kofta, tabbouleh, garlic yogurt", cuisine: "Lebanese", tags: ["weeknight", "grill"] },
  { title: "Turkey and black bean chili, cornbread", cuisine: "American", tags: ["make-ahead", "kids love it", "freezer friendly"] },
  { title: "Sweet potato and peanut stew, coconut rice", cuisine: "West African", tags: ["veg", "make-ahead"] },
  { title: "Chicken piccata, orzo, wilted spinach", cuisine: "Italian", tags: ["weeknight", "quick"] },
  { title: "Spiced lentil shepherd's pie", cuisine: "British", tags: ["veg", "make-ahead", "cozy"] },
  { title: "Shrimp and grits, scallion butter", cuisine: "Southern", tags: ["weeknight", "comfort"] },
  { title: "Soba with sesame greens and soft egg", cuisine: "Japanese", tags: ["veg", "light", "quick"] },
  { title: "Roast pork loin, apples, braised cabbage", cuisine: "German", tags: ["sunday", "make-ahead"] },
  { title: "Paneer tikka, charred peppers, naan", cuisine: "Indian", tags: ["veg", "kids love it"] },
  { title: "Chicken tinga tostadas, avocado, queso fresco", cuisine: "Mexican", tags: ["weeknight", "make-ahead"] },
  { title: "Baked ziti with ricotta and kale", cuisine: "Italian", tags: ["veg", "kids love it", "freezer friendly"] },
  { title: "Moroccan lamb tagine, apricots, almonds", cuisine: "Moroccan", tags: ["make-ahead", "sunday"] },
  { title: "Ginger scallion whole fish, steamed greens", cuisine: "Cantonese", tags: ["light", "special"] },
  { title: "Butternut squash lasagna, sage brown butter", cuisine: "Italian", tags: ["veg", "cozy", "make-ahead"] },
];
