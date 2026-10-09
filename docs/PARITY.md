# Signal UI parity audit

## Reference and capture method

There is no `docs/reference/` directory in this checkout. This audit uses Signal Desktop's three-pane desktop patterns and Signal Android's single compose affordance and mobile contact picker as the reference. Baseline Playwright captures are the 30 screenshots in `docs/screenshots/`: chat list, chat, group info, settings, and new-message picker at 375, 768, and 1280px in light and dark themes. The images are a local implementation baseline; they are not screenshots of Signal itself.

The baseline differences below were recorded before the fixes. `docs/screenshots/parity/` contains 54 final captures: chat list, chat, group info, settings, new-message picker, welcome, phone entry, OTP, and profile setup, each at 375, 768, and 1280px in light and dark themes. These are screenshots of this application, not Signal reference screenshots; no `docs/reference/` assets were provided.

## Baseline differences

| Screen / state | Visible differences from Signal | Width/theme notes |
|---|---|---|
| Welcome | Marketing-style centered card, oversized mark and demo copy make this look like a web landing page rather than Signal's restrained sign-in/onboarding surfaces. | Same hierarchy in both themes; mobile card has less breathing room. |
| Phone / username entry | Demo-code and demo-account hints are visible in the form; country/phone entry is one generic text field; wake-up copy is implementation-specific. | At 375px, form/card controls use generic web form spacing. |
| OTP | One ordinary text field and helper text stand in for a focused code-entry control; resend/edit-number affordances are absent. | All widths; dark inputs rely on borders rather than Signal's tonal fields. |
| Profile setup | File input is a browser-native control; submit failures are swallowed with no inline feedback; profile photo/name controls do not share the settings profile treatment. | All widths/themes. |
| Conversation list | On mobile both the header pencil and floating compose button are visible; the 52px FAB is clipped/visually off-centre and list content can scroll beneath it. Contact results follow insertion order and lack A–Z sections/index. | Double compose is most obvious at 375px; 768px also switches to the narrow sidebar layout. |
| Conversation list: pinned, muted, unread, selected, search | Pinned/unread/muted data is present, but selected/highlight states are generic flat fills; unread badge uses the app blue rather than Signal's restrained count treatment; search people results are appended as an ungrouped block and omit secondary details. | Hover cannot be inspected on touch; colors differ in dark mode. |
| New message | Contact list has no grouping, secondary line, inline search highlighting, alpha jump index, or keyboard row navigation. “New group” and “Add contact” are grey buttons at the bottom, not leading action rows. | Modal is a generic rounded web dialog; narrow view leaves little room for the list. |
| New group | Members are insertion-ordered bare checkbox rows; selected users are not summarized as removable chips; group name is shown before the list instead of a clear selection-first step. | Long lists and small viewports can compete with the modal height. |
| Chat header and menu | Header uses generic call/video/search/more icons and spacing; contact details are opened by the overflow action, but the menu/profile affordance hierarchy does not match Signal. | At 375px the action row is crowded; tablet uses the desktop action density. |
| Message bubbles | Bubbles are broad rounded rectangles with only grouped top corners changed; there are no Signal-style tails; message max-width and vertical rhythm are loose. | Incoming/outgoing color contrast differs by theme. |
| Bubble metadata and status | Time sits in every bubble footer; ticks are small and status color/shape treatment is simplified. | Dense messages wrap metadata on narrow screens. |
| Quoted reply, reactions, attachments, disappearing timer, deleted message | Quotes/reactions are functional but generic bordered cards/chips; file/image presentation and timer/deleted placeholders lack Signal's compact inline treatment. | Long filenames/quotes and reaction chips risk consuming bubble width. |
| Message context actions | Reply/react controls appear as hover buttons; copy/delete are not in a Signal-like message action menu. | Hover-only controls are inaccessible on touch unless there is an alternate action. |
| Composer | Pill border is heavier than Signal; emoji, paperclip, and send controls use generic spacing; attachment/reply staging consumes separate vertical blocks. | At 375px composer padding is tight; keyboard/focus affordances are inconsistent. |
| Date dividers | Centered plain date labels do not use Signal's subtle pill/background treatment. | Similar in light/dark. |
| Typing indicator | Three animated dots plus literal “typing” is a generic status line rather than a compact participant/activity bubble. | Low visual weight on both themes. |
| Scroll-to-latest | Button is a separate floating-looking pill between list and composer instead of a discreet in-thread affordance. | It previously overlapped messages at phone width; geometry is now regression-tested. |
| Group info | Generic form fields, browser select, text admin actions, and red Leave button make the panel feel like an admin console. | 768px dialog is tall; scroll and safe-area treatment need review. |
| Settings: profile | Profile upload was browser-native before the prior polish; section spacing and controls remain web-form-like. | Light/dark screenshots show different contrast; mobile page is independently scrollable. |
| Settings: privacy / blocked users | “Blocked users — Manage” is static copy, so there is no blocked list or obvious Unblock action. | Both themes. |
| Settings: notifications / appearance / linked devices / stories | Toggles and Coming Soon rows are generic settings rows; disabled feature state is not distinguished from an active setting. | All widths/themes. |
| Toasts | Toast is a dark fixed web notification with a large shadow, not a compact theme-aware Signal toast. | May cover bottom controls on short screens. |
| Confirmation dialogs | Confirmation dialog is a second generic modal; destructive action prominence and button order need tightening. | Narrow view must retain safe margins. |
| Empty states | Empty chat/list states use generic instructional copy and large icons; list empty state is hidden on mobile. | Empty-state hierarchy differs across responsive modes. |
| Error and loading states | Loading uses text and errors use browser-like red copy/actions; no skeletons for list/detail loading. | Layout shifts when requests settle. |
| Shared visual system | Inter is present, but icon sizes, radii, spacing, hover/focus states, transitions, scrollbar styling, and truncation rules are not consistently shared across features. | Dark theme relies on a small set of tokens and several hard-coded colors. |

## Fix order

1. Correct mobile compose behavior and the full contact-picker flow (A–Z ordering/grouping, keyboard, search, group selection, no destructive actions in lists).
2. Make block/unblock discoverable only in contact details and Settings > Privacy, with a confirmed block, toast, and direct unblock action.
3. Use the 375/768/1280 light/dark captures to correct modal/list geometry and any clearly visible overflow, clipping, or focus issues.
4. Resolve remaining shared parity issues in order of screen visibility and retain explicit product gaps where the clone has no corresponding backend capability.

## Final audit and verification

### Findings after the fixes

| Screen / state | Current screenshot finding | Disposition |
|---|---|---|
| Welcome, phone/username, OTP, profile setup | The pages fit the target widths and both themes. This clone keeps its demo OTP hint and a single phone/username field; it does not reproduce Signal's production registration/account-verification service. | Screenshot coverage added; product-level flow remains intentionally demo-only. |
| Conversation list, search, selected/unread/muted | The mobile list now has a single 56px compose FAB with safe-area placement and reserved list space; tablet/desktop use the aligned pencil only. The app has its own seed names and unread counts, so captures are state samples rather than a pixel comparison. | Compose controls fixed and tested at all three breakpoints. A–Z applies to the contact picker; conversation ordering remains by latest activity. |
| New message and new group | Action rows lead the picker; contacts are grouped and sticky A–Z with a narrow mobile jump index, names have secondary details, search highlights matches, and group members appear as removable chips. The scroll region stays inside the dialog. | Fixed and covered by sorting/search/keyboard/group-validation tests. |
| Chat header and contact info | Header actions fit at phone width. The overflow opens the details panel; direct-chat blocking is confirmed there and reports a toast. The app's placeholder calls/search controls do not match Signal's complete desktop integrations. | Blocking location fixed and tested. Placeholder product actions remain visible. |
| Message bubbles, ticks, replies, reactions, files, deleted content, timer | Grouped corners, delivery/read status, quoted replies, reactions, attachments, and timer are visible in captures and functional tests. Bubbles are still simpler than Signal's exact shape/metadata system (no full pixel-matched tails/typography). | Interaction coverage passes; exact shape/spacing parity remains open. |
| Message context actions, composer, date dividers, typing, latest control | Composer and latest control fit the narrow viewport; latest control stays between the message viewport and composer. The current reply/react affordances, plain date labels, and typing treatment remain simplified. | Latest overlap remains fixed and geometry-tested; other styling parity remains open. |
| Group info | Member/admin actions and timer controls render in the tested light/dark layouts. The dialog and controls remain a simplified web panel versus Signal's native group details. | Responsive screenshots captured; exact component parity remains open. |
| Settings, blocked users | Privacy now opens a live blocked-user list with direct Unblock actions. Profile, privacy, notification, and appearance controls remain a simplified web settings layout; linked devices and Stories are Coming Soon. | Blocked-user flow fixed and tested; linked-device and Stories functionality is a product gap. |
| Toasts, confirmation, empty/error/loading | Toast and confirmation behaviors are functional. Loading/errors still use concise text states rather than a full skeleton system; confirmation layout is the shared web modal. | Existing retry, expiry, blocking, and toast tests pass; visual parity remains open. |
| Shared iconography, spacing, typography, focus, hover, transitions, scrollbars, truncation | Inter and the shared Lucide icon set are consistent; picker hover/focus, sticky headings, truncation, and a thin list scrollbar are covered in screenshots. Some older screens still have individual spacing/radius/color values. | Picker and compose states corrected. Global pixel-level token alignment remains open. |

### Checks performed

- Playwright captures: 375, 768, and 1280px, light and dark, for chat list, chat, group info, settings, and new message; onboarding capture test covers welcome, phone entry, OTP, and profile setup.
- Playwright assertions cover compose exclusivity and bounds, modal bounds and internal scrolling, A–Z/sticky grouping, focused search, keyboard selection, group validation, no Block action in picker lists, confirmed blocking, Settings unblock, and error-free main flows.
- No Signal reference screenshots were present. Findings are grounded in the app captures and the stated Signal design patterns; exact pixel parity cannot be verified against an absent reference image set.
