# techaxon-iam-traefik

## Run
```
pnpm dev 
```

## Development
```
code techaxon.code-workspace
```

## Project Apps
```
https://idp.techaxon.localhost

https://lms.techaxon.localhost

https://dashboard.techaxon.localhost
user: admin
pass: password
```
 
## Powershell run as administrator fix ssl red https warning - reopen your browser
```
Import-Certificate -FilePath ".\certs_data\rootCA.pem" -CertStoreLocation Cert:\LocalMachine\Root
```