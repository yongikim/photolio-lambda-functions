# Build the source code
npm run build

# Zip the source code
name=$(basename $(pwd))
cd dist && zip -q -r ../${name}.zip index.js && cd ..

# Deploy the source code
aws lambda update-function-code \
  --function-name $name \
  --zip-file fileb://${name}.zip \
  --profile admin |
  jq '.FunctionArn' --raw-output

# Clean up
rm ${name}.zip
