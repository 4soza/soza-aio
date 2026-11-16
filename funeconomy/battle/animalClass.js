/*
 * Class hewan (Tank / Warrior / Mage / Support) dan weapon yang cocok untuk class itu.
 * Class ditentukan dari stat dasar hewan: stat tertinggi menang (Tank = rata-rata HP, PR, MR).
 */
const WeaponInterface = require('./WeaponInterface.js');

const CLASSES = {
    // Tank: bertahan dan melindungi tim. Shield, Orb, Rune, Banner.
    Tank: [5, 6, 4, 16],
    // Warrior: mengandalkan STR. Sword, Bow, Dagger, Axe, Scythe, Leeching Scythe, Foul Fish, Conduit Claw, Crossbow.
    Warrior: [1, 3, 8, 15, 17, 20, 21, 23, 24],
    // Mage: mengandalkan MAG. Flame, Energy, Vampiric, Wand, Staff of Sight, Frost.
    Mage: [10, 11, 7, 9, 26, 27],
    // Support: menyembuhkan dan mengisi WP. Healing, Spirit, Scepter, Resurrection, Celebration, Purity, Druid.
    Support: [2, 12, 13, 14, 18, 19, 25]
};

function scores(animal) {
    return {
        Tank: (animal.hpr + animal.prr + animal.mrr) / 3,
        Warrior: animal.attr,
        Mage: animal.magr,
        Support: animal.wpr
    };
}

/** Class dengan skor tertinggi; kalau seri, urutan Tank, Warrior, Mage, Support. */
function classOf(animal) {
    const s = scores(animal);
    return Object.keys(CLASSES).reduce((best, name) => (s[name] > s[best] ? name : best), 'Tank');
}

/** Id weapon yang cocok dengan class hewan ini (hanya yang ada di bot). */
function weaponIdsFor(animal) {
    return CLASSES[classOf(animal)].filter((id) => WeaponInterface.weapons[id]);
}

module.exports = { CLASSES, classOf, weaponIdsFor, scores };
