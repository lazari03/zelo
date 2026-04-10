# Firestore Security Rules for Zelo

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated users can read/write their own data
    match /conversations/{conversationId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    match /instagram_accounts/{pageId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    match /orders/{orderId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    match /analytics/{userId}/daily/{date} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

- Update these rules as your data model evolves.
