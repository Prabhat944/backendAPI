import express from "express";
import {
  createUserById,
  deleteUserById,
  getAllUserList,
  getUserById,
  registerUser,
  specialFunc,
  updateUserById,
} from "../controller/user.js";

const router = express.Router();

router.get("/users/all", getAllUserList);

router.post("/users/new", registerUser);

router.get("/userId/special", specialFunc);

// router.get('/userId/:email',createUserById);

router
  .route("/userId/:id")
  .get(getUserById)
  .put(updateUserById)
  .delete(deleteUserById);

// router.get('/userId/:id',getUserById);
// router.put('/userId/:id',updateUserById);
// router.delete('/userId/:id',deleteUserById);

export default router;
