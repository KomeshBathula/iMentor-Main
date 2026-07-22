import unittest
from crawler.config import Settings

class TestConfig(unittest.TestCase):
    def test_settings_load(self):
        settings = Settings()
        self.assertEqual(settings.env, "development")
        self.assertGreater(settings.crawler.max_depth, 0)
        self.assertIsNotNone(settings.logging.level)

if __name__ == "__main__":
    unittest.main()
