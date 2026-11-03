from frappe.tests import UnitTestCase

from nova_core.gat import calc_fine, completed_years


class TestGat(UnitTestCase):
	def test_fine(self):
		# due 15th: 16th = 50, 17th = 60, 18th = 70, no cap
		self.assertEqual([calc_fine(d, 50, 10) for d in (-3, 0, 1, 2, 3, 60)], [0, 0, 50, 60, 70, 640])

	def test_completed_years(self):
		# member leaves 18 months after start: only year 1 counts
		years = list(completed_years("2025-06-01", "2026-12-01"))
		self.assertEqual([(y, str(s), str(e)) for y, s, e in years], [(1, "2025-06-01", "2026-05-31")])
		self.assertEqual(list(completed_years("2025-06-01", "2026-05-31")), [])
