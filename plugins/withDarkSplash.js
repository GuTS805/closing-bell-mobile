// Android 12+ draws its own launch splash from windowSplashScreenBackground, and the app theme's
// windowBackground shows while JavaScript loads. Both otherwise default to white in light mode and
// flash before the dark app.
const { withAndroidStyles, AndroidConfig } = require('@expo/config-plugins');

module.exports = function withDarkSplash(config, { color = '#0b0e10' } = {}) {
  return withAndroidStyles(config, config => {
    const values = [
      [{ name: 'AppTheme', parent: 'Theme.AppCompat.DayNight.NoActionBar' }, 'android:windowBackground'],
      [{ name: 'Theme.App.SplashScreen', parent: 'AppTheme' }, 'android:windowBackground'],
      [{ name: 'Theme.App.SplashScreen', parent: 'AppTheme' }, 'android:windowSplashScreenBackground'],
    ];
    for (const [parent, name] of values) {
      config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, { add: true, parent, name, value: color });
    }
    return config;
  });
};
