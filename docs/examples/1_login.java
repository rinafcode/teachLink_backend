import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

public class LoginExample {
    public static void login() throws IOException {
        URL url = new URL("http://localhost:3000/auth/login");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        
        connection.setRequestMethod("POST");
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setDoOutput(true);
        
        String jsonInput = "{"email":"learner@example.com","password":"Password123!"}";
        try (OutputStream os = connection.getOutputStream()) {
            byte[] input = jsonInput.getBytes("utf-8");
            os.write(input, 0, input.length);
        }
        
        int code = connection.getResponseCode();
        System.out.println("Response Code: " + code);
    }
    
    public static void main(String[] args) throws IOException {
        login();
    }
}