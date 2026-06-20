-- ============================================
-- RENAME: Vented Diamond Disc consumable group headings
-- Run in Supabase SQL Editor. Safe + idempotent.
--   "Vented Diamond Discs 150mm / 6\""  ->  "150mm / 6\" - Vented Diamond Discs"
--   "Vented Diamond Discs 225mm / 9\""  ->  "225mm / 9\" - Vented Diamond Discs"
-- (updates every grit variant in each group so they stay grouped together)
-- ============================================

UPDATE public.products
SET consumable_group = '150mm / 6" - Vented Diamond Discs'
WHERE consumable_group = 'Vented Diamond Discs 150mm / 6"';

UPDATE public.products
SET consumable_group = '225mm / 9" - Vented Diamond Discs'
WHERE consumable_group = 'Vented Diamond Discs 225mm / 9"';
