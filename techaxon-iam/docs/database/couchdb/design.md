curl -X PUT http://admin:secret123@127.0.0.1:5984/auth_db/_design/users \
  -H "Content-Type: application/json" \
  -d '{
    "views": {
      "by-email": {
        "map": "function (doc) { if (doc.type === \"user\") emit(doc.emailNormalized, doc); }"
      }
    }
  }'
{"error":"unauthorized","reason":"You are not authorized to access this db."}