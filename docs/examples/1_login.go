package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
)

func Login() {
	client := &http.Client{}
	payload := map[string]interface{}{
		"email": "learner@example.com",
		"password": "Password123!"
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "http://localhost:3000/auth/login", bytes.NewBuffer(body))
	req.Header.Add("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)
	var result interface{}
	json.Unmarshal(body, &result)
	fmt.Println("Response:", result)
}

func main() {
	login()
}