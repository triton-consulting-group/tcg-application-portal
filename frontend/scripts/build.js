// Never let the retired admin token reach the client bundle, even if it's still set in the environment.
// dotenv (used by react-scripts) does not override keys that already exist, so an empty value wins over .env files.
process.env.REACT_APP_ADMIN_API_TOKEN = "";

require("react-scripts/scripts/build");
