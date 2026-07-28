package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
)

func CreatePaymentIntent() {
	client := &http.Client{}
	payload := map[string]interface{}{
		"courseId": "8e4fd4f8-d8f3-46b5-8786-6f7167a654f4",
		"amount": 3999,
		"currency": "USD"
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "http://localhost:3000/payments/create-intent", bytes.NewBuffer(body))
	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", accessToken))

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
	createPaymentIntent()
}