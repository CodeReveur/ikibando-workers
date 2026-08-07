/**
 * The app's stacking order, in one place.
 *
 * Overlay z-indexes had drifted into unrelated magic numbers (modals at 300, 500, 999, 1100,
 * 1200, 1300 and 9999), so whether a dialog appeared above the floating help buttons was
 * accidental. The apply modal at 999 lost to the BazaBot launcher at 1000 and to the job page's
 * own sticky bar, which is the bug this scale fixes.
 *
 * The order that matters: page furniture < floating widgets < dialogs < anything a dialog opens.
 */
export const Z = {
  /** Sticky page furniture: the job detail apply ribbon. */
  stickyBar: 1001,

  /** Globally mounted floating launchers (BazaBot, donate). */
  floating: 1000,

  /** Any primary dialog. Must clear both the sticky bar and the floating launchers. */
  modal: 1500,

  /** An overlay opened from inside a dialog (camera, image cropper, reason prompt). */
  modalNested: 1700,
} as const;
