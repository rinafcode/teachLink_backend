package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
)

func SearchCourses() {
	client := &http.Client{}
	req, _ := http.NewRequest("GET", "http://localhost:3000/search", nil)
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
	searchCourses()
}