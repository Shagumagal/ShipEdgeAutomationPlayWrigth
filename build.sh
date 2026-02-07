# /bin/sh

# Set current time for zip file name
current_time=$(date "+%d-%m-%Y-%H-%M-%S")

# Package generation
zip -r tests-$current_time.zip . -x "node_modules/*" -x ".idea/*" -x "/allure-results/*" -x "/allure-report/*" -x ".git/*" -x "package-lock.json"