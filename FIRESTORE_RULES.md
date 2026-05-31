# Tambahkan rules berikut ke Firestore Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{uid} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth.uid == uid;
      allow delete: if false;
    }

    match /products/{id} {
      allow read: if true;
      allow write: if request.auth != null && 
                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /categories/{id} {
      allow read: if true;
      allow write: if request.auth != null && 
                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /orders/{id} {
      allow read: if request.auth != null;
      allow create: if true;
      allow update: if request.auth != null;
      allow delete: if false;
    }

    match /otps/{id} {
      allow read, write: if false;
    }

    match /settings/{id} {
      allow read: if true;
      allow write: if request.auth != null && 
                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /promo_codes/{id} {
      allow read: if true;
      allow write: if request.auth != null && 
                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /reviews/{id} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }

    match /affiliate_transactions/{id} {
      allow read: if request.auth != null;
      allow create: if true;
      allow update: if request.auth != null && 
                    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /copy_attempts/{id} {
      allow write: if true;
      allow read: if request.auth != null && 
                  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```
