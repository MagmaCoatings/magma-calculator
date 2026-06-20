-- ============================================
-- SEED: real consumables list (discs) — grouped families with grit variants
-- Run in Supabase SQL Editor AFTER consumables.sql. Safe + idempotent.
--
-- Each row is a product flagged is_consumable = true:
--   * name                 = the variant label shown in the row (grit / type)
--   * consumable_group     = family heading the variant sits under
--   * consumable_min_order = min order across the whole family (mix & match) — STR only
--   * price                = price EACH, pack_size 1 / pack_unit 'each'
-- Edit prices / add grits later in Admin → Products. Delete any you don't sell.
-- ============================================

-- Remove the earlier placeholder samples (safe if they aren't there)
DELETE FROM public.products WHERE code IN (
  'disc_diamond_125','disc_diamond_180','disc_sanding_125','disc_sanding_225',
  'pad_diamond_polish','mesh_fibre','tape_masking_50','roller_micro',
  'mixing_paddle','gloves_nitrile','disc_diamond','pad_sanding'
);

INSERT INTO public.products
  (code, name, consumable_group, consumable_min_order, pack_size, pack_unit, price, is_consumable, is_active, display_order)
VALUES
  -- STR Discs 430mm (silicon carbide) — 10 min order, mix & match grits
  ('str_sic_16',  '16g',  'STR Discs 430mm (silicon carbide)', 10, 1, 'each', 7.50, true, true, 900),
  ('str_sic_24',  '24g',  'STR Discs 430mm (silicon carbide)', 10, 1, 'each', 7.50, true, true, 901),
  ('str_sic_40',  '40g',  'STR Discs 430mm (silicon carbide)', 10, 1, 'each', 6.50, true, true, 902),
  ('str_sic_60',  '60g',  'STR Discs 430mm (silicon carbide)', 10, 1, 'each', 6.50, true, true, 903),
  ('str_sic_80',  '80g',  'STR Discs 430mm (silicon carbide)', 10, 1, 'each', 7.50, true, true, 904),
  ('str_sic_120', '120g', 'STR Discs 430mm (silicon carbide)', 10, 1, 'each', 7.50, true, true, 905),

  -- STR Discs 430mm (mesh) — 10 min order, mix & match grits
  ('str_mesh_60',  '60g',  'STR Discs 430mm (mesh)', 10, 1, 'each', 7.20, true, true, 910),
  ('str_mesh_120', '120g', 'STR Discs 430mm (mesh)', 10, 1, 'each', 7.20, true, true, 911),
  ('str_mesh_180', '180g', 'STR Discs 430mm (mesh)', 10, 1, 'each', 7.20, true, true, 912),
  ('str_mesh_220', '220g', 'STR Discs 430mm (mesh)', 10, 1, 'each', 7.20, true, true, 913),

  -- 150mm / 6" Vented Diamond Discs — priced each, no minimum
  ('vd150_50',  '50g',  '150mm / 6" - Vented Diamond Discs', NULL, 1, 'each', 20.00, true, true, 920),
  ('vd150_100', '100g', '150mm / 6" - Vented Diamond Discs', NULL, 1, 'each', 20.00, true, true, 921),
  ('vd150_200', '200g', '150mm / 6" - Vented Diamond Discs', NULL, 1, 'each', 20.00, true, true, 922),
  ('vd150_220', '220g', '150mm / 6" - Vented Diamond Discs', NULL, 1, 'each', 20.00, true, true, 923),

  -- 225mm / 9" Vented Diamond Discs — priced each, no minimum
  ('vd225_50',  '50g',  '225mm / 9" - Vented Diamond Discs', NULL, 1, 'each', 38.50, true, true, 930),
  ('vd225_100', '100g', '225mm / 9" - Vented Diamond Discs', NULL, 1, 'each', 38.50, true, true, 931),
  ('vd225_200', '200g', '225mm / 9" - Vented Diamond Discs', NULL, 1, 'each', 38.50, true, true, 932),
  ('vd225_220', '220g', '225mm / 9" - Vented Diamond Discs', NULL, 1, 'each', 38.50, true, true, 933),

  -- Grinding Discs 175mm / 7" — priced each, no minimum
  ('grind175_yellow', '30/40g — Yellow / General',  'Grinding Discs 175mm / 7"', NULL, 1, 'each', 63.00, true, true, 940),
  ('grind175_blue',   '30/40g — Blue / Hard Bond',  'Grinding Discs 175mm / 7"', NULL, 1, 'each', 70.00, true, true, 941)
ON CONFLICT (code) DO UPDATE SET
  name                 = EXCLUDED.name,
  consumable_group     = EXCLUDED.consumable_group,
  consumable_min_order = EXCLUDED.consumable_min_order,
  pack_size            = EXCLUDED.pack_size,
  pack_unit            = EXCLUDED.pack_unit,
  price                = EXCLUDED.price,
  is_consumable        = EXCLUDED.is_consumable,
  is_active            = EXCLUDED.is_active,
  display_order        = EXCLUDED.display_order;
