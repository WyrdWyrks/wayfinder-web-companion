// Mirrors DisplayModule::InputID in the firmware — the IDs the display module
// dispatches to the active window. BUTTON_1/2 are context-dependent function
// buttons, BUTTON_3 is back/cancel and BUTTON_4 is select/confirm. Projects may
// define their own IDs from 16 up, so this list isn't exhaustive.
export const DisplayInputID = {
    BUTTON_1: 1,
    BUTTON_2: 2,
    BUTTON_3: 3,
    BUTTON_4: 4,
    ENC_UP: 5,
    ENC_DOWN: 6,
    ENC_BUTTON: 7,
} as const;

export type DisplayInputID = typeof DisplayInputID[keyof typeof DisplayInputID];
